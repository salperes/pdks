import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessLog, Personnel } from '../entities';
import { SettingsService } from '../settings/settings.service';

/* ---------- work config ---------- */

interface WorkConfig {
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  tzOffsetMs: number;
  tzStr: string; // e.g. "+03:00"
  workStartLabel: string;
  workEndLabel: string;
  isFlexible: boolean;
  flexGraceMinutes: number | null;
  shiftDurationMinutes: number;
  calculationMode: 'firstLast' | 'paired';
}

/* ---------- helpers ---------- */

const pad2 = (n: number) => String(n).padStart(2, '0');

function toLocal(utc: Date, cfg: WorkConfig): Date {
  return new Date(utc.getTime() + cfg.tzOffsetMs);
}

function dateKey(utc: Date, cfg: WorkConfig): string {
  return toLocal(utc, cfg).toISOString().slice(0, 10);
}

function isLate(utc: Date, cfg: WorkConfig): boolean {
  const l = toLocal(utc, cfg);
  const h = l.getUTCHours();
  const m = l.getUTCMinutes();
  const timeMinutes = h * 60 + m;

  if (cfg.isFlexible && cfg.flexGraceMinutes) {
    const windowEnd = cfg.startHour * 60 + cfg.startMin + cfg.flexGraceMinutes;
    return timeMinutes > windowEnd;
  }

  return h > cfg.startHour || (h === cfg.startHour && m > cfg.startMin);
}

function isEarly(utc: Date, cfg: WorkConfig, firstInUtc?: Date | null): boolean {
  const l = toLocal(utc, cfg);
  const h = l.getUTCHours();
  const m = l.getUTCMinutes();
  const timeMinutes = h * 60 + m;

  if (cfg.isFlexible && cfg.flexGraceMinutes && firstInUtc) {
    const firstInLocal = toLocal(firstInUtc, cfg);
    const firstInMinutes = firstInLocal.getUTCHours() * 60 + firstInLocal.getUTCMinutes();
    const expectedExitMinutes = firstInMinutes + cfg.shiftDurationMinutes;
    return timeMinutes < expectedExitMinutes;
  }

  return h < cfg.endHour || (h === cfg.endHour && m < cfg.endMin);
}

function workDaysInMonth(year: number, month: number): number {
  const days = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

function workDaysInRange(startStr: string, endStr: string): number {
  let count = 0;
  const cur = new Date(startStr);
  const end = new Date(endStr);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

interface DayResult {
  firstIn: Date | null;
  lastOut: Date | null;
  totalMinutes: number;
  isLate: boolean;
  isEarly: boolean;
  punchCount: number;
}

/** Paired (net) calculation: match each IN with the next OUT, sum durations */
function calcPairedMinutes(logs: AccessLog[]): number {
  const sorted = [...logs].sort(
    (a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime(),
  );
  let total = 0;
  let openIn: Date | null = null;
  for (const log of sorted) {
    if (log.direction === 'in') {
      if (!openIn) openIn = new Date(log.eventTime);
    } else if (log.direction === 'out' && openIn) {
      const outTime = new Date(log.eventTime);
      if (outTime > openIn) {
        total += (outTime.getTime() - openIn.getTime()) / 60000;
      }
      openIn = null;
    }
  }
  return total;
}

function processDayLogs(logs: AccessLog[], cfg: WorkConfig): DayResult {
  const inLogs = logs.filter((l) => l.direction === 'in');
  const outLogs = logs.filter((l) => l.direction === 'out');

  const firstIn =
    inLogs.length > 0 ? new Date(inLogs[0].eventTime) : null;
  const lastOut =
    outLogs.length > 0 ? new Date(outLogs[outLogs.length - 1].eventTime) : null;

  let totalMinutes = 0;
  if (cfg.calculationMode === 'paired') {
    totalMinutes = calcPairedMinutes(logs);
  } else {
    if (firstIn && lastOut && lastOut > firstIn) {
      totalMinutes = (lastOut.getTime() - firstIn.getTime()) / 60000;
    }
  }

  return {
    firstIn,
    lastOut,
    totalMinutes,
    isLate: firstIn ? isLate(firstIn, cfg) : false,
    isEarly: lastOut ? isEarly(lastOut, cfg, firstIn) : false,
    punchCount: logs.length,
  };
}

/** Resolve work config for a person's day logs based on first entry location */
function resolveConfigForLogs(
  logs: AccessLog[],
  locationConfigs: Map<string, WorkConfig>,
  globalCfg: WorkConfig,
): WorkConfig {
  const firstIn = logs.find((l) => l.direction === 'in');
  const locId = firstIn?.locationId;
  if (locId && locationConfigs.has(locId)) {
    return locationConfigs.get(locId)!;
  }
  return globalCfg;
}

/* ---------- service ---------- */

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(AccessLog)
    private readonly logRepo: Repository<AccessLog>,
    @InjectRepository(Personnel)
    private readonly personnelRepo: Repository<Personnel>,
    private readonly settingsService: SettingsService,
  ) {}

  private async getConfigs() {
    return this.settingsService.getAllLocationConfigs();
  }

  /* ── Daily Attendance ─────────────────────────────── */

  async getDailyAttendance(dateStr: string) {
    const { globalCfg, locationConfigs } = await this.getConfigs();
    const dayStart = new Date(`${dateStr}T00:00:00${globalCfg.tzStr}`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999${globalCfg.tzStr}`);

    const [allPersonnel, logs] = await Promise.all([
      this.personnelRepo.find({
        where: { isActive: true },
        order: { firstName: 'ASC', lastName: 'ASC' },
      }),
      this.logRepo
        .createQueryBuilder('log')
        .where('log.personnelId IS NOT NULL')
        .andWhere('log.eventTime >= :s', { s: dayStart })
        .andWhere('log.eventTime <= :e', { e: dayEnd })
        .orderBy('log.eventTime', 'ASC')
        .getMany(),
    ]);

    const byPerson = new Map<string, AccessLog[]>();
    for (const log of logs) {
      const arr = byPerson.get(log.personnelId) ?? [];
      arr.push(log);
      byPerson.set(log.personnelId, arr);
    }

    const records = allPersonnel.map((p) => {
      const pLogs = byPerson.get(p.id) ?? [];
      const cfg = resolveConfigForLogs(pLogs, locationConfigs, globalCfg);
      const day = processDayLogs(pLogs, cfg);

      return {
        personnelId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        department: p.department || '',
        firstIn: day.firstIn?.toISOString() ?? null,
        lastOut: day.lastOut?.toISOString() ?? null,
        totalHours: Math.round((day.totalMinutes / 60) * 100) / 100,
        isPresent: pLogs.length > 0,
        isLate: day.isLate,
        isEarlyLeave: day.isEarly,
        punchCount: day.punchCount,
        workStart: cfg.workStartLabel,
        workEnd: cfg.workEndLabel,
        isFlexible: cfg.isFlexible,
      };
    });

    const present = records.filter((r) => r.isPresent).length;

    return {
      date: dateStr,
      workStart: globalCfg.workStartLabel,
      workEnd: globalCfg.workEndLabel,
      records,
      summary: {
        totalPersonnel: allPersonnel.length,
        present,
        absent: allPersonnel.length - present,
        late: records.filter((r) => r.isLate).length,
        earlyLeave: records.filter((r) => r.isEarlyLeave).length,
      },
    };
  }

  /* ── Monthly Summary ──────────────────────────────── */

  async getMonthlySummary(year: number, month: number) {
    const { globalCfg, locationConfigs } = await this.getConfigs();
    const lastDay = new Date(year, month, 0).getDate();
    const monthStart = new Date(
      `${year}-${pad2(month)}-01T00:00:00${globalCfg.tzStr}`,
    );
    const monthEnd = new Date(
      `${year}-${pad2(month)}-${pad2(lastDay)}T23:59:59.999${globalCfg.tzStr}`,
    );
    const workDays = workDaysInMonth(year, month);

    const [allPersonnel, logs] = await Promise.all([
      this.personnelRepo.find({
        where: { isActive: true },
        order: { firstName: 'ASC', lastName: 'ASC' },
      }),
      this.logRepo
        .createQueryBuilder('log')
        .where('log.personnelId IS NOT NULL')
        .andWhere('log.eventTime >= :s', { s: monthStart })
        .andWhere('log.eventTime <= :e', { e: monthEnd })
        .orderBy('log.eventTime', 'ASC')
        .getMany(),
    ]);

    const byPersonDay = new Map<string, Map<string, AccessLog[]>>();
    for (const log of logs) {
      const pid = log.personnelId;
      const dk = dateKey(new Date(log.eventTime), globalCfg);
      if (!byPersonDay.has(pid)) byPersonDay.set(pid, new Map());
      const dayMap = byPersonDay.get(pid)!;
      const arr = dayMap.get(dk) ?? [];
      arr.push(log);
      dayMap.set(dk, arr);
    }

    const records = allPersonnel.map((p) => {
      const dayMap = byPersonDay.get(p.id) ?? new Map();
      let daysPresent = 0;
      let lateCount = 0;
      let earlyLeaveCount = 0;
      let totalMinutes = 0;

      for (const [, dayLogs] of dayMap) {
        daysPresent++;
        const cfg = resolveConfigForLogs(dayLogs, locationConfigs, globalCfg);
        const day = processDayLogs(dayLogs, cfg);
        if (day.isLate) lateCount++;
        if (day.isEarly) earlyLeaveCount++;
        totalMinutes += day.totalMinutes;
      }

      const attendanceRate =
        workDays > 0
          ? Math.round((daysPresent / workDays) * 10000) / 100
          : 0;

      return {
        personnelId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        department: p.department || '',
        daysPresent,
        daysAbsent: workDays - daysPresent,
        lateCount,
        earlyLeaveCount,
        totalHours: Math.round((totalMinutes / 60) * 100) / 100,
        attendanceRate,
      };
    });

    const totalLate = records.reduce((s, r) => s + r.lateCount, 0);
    const totalEarly = records.reduce((s, r) => s + r.earlyLeaveCount, 0);
    const avgRate =
      records.length > 0
        ? Math.round(
            (records.reduce((s, r) => s + r.attendanceRate, 0) /
              records.length) *
              100,
          ) / 100
        : 0;

    return {
      year,
      month,
      workDays,
      workStart: globalCfg.workStartLabel,
      workEnd: globalCfg.workEndLabel,
      records,
      summary: {
        totalPersonnel: allPersonnel.length,
        avgAttendanceRate: avgRate,
        totalLate,
        totalEarlyLeave: totalEarly,
      },
    };
  }

  /* ── Department Summary ───────────────────────────── */

  async getDepartmentSummary(startDateStr: string, endDateStr: string) {
    const { globalCfg, locationConfigs } = await this.getConfigs();
    const rangeStart = new Date(`${startDateStr}T00:00:00${globalCfg.tzStr}`);
    const rangeEnd = new Date(`${endDateStr}T23:59:59.999${globalCfg.tzStr}`);
    const workDays = workDaysInRange(startDateStr, endDateStr);

    const [allPersonnel, logs] = await Promise.all([
      this.personnelRepo.find({ where: { isActive: true } }),
      this.logRepo
        .createQueryBuilder('log')
        .where('log.personnelId IS NOT NULL')
        .andWhere('log.eventTime >= :s', { s: rangeStart })
        .andWhere('log.eventTime <= :e', { e: rangeEnd })
        .orderBy('log.eventTime', 'ASC')
        .getMany(),
    ]);

    const byPersonDay = new Map<string, Map<string, AccessLog[]>>();
    for (const log of logs) {
      const pid = log.personnelId;
      const dk = dateKey(new Date(log.eventTime), globalCfg);
      if (!byPersonDay.has(pid)) byPersonDay.set(pid, new Map());
      const dayMap = byPersonDay.get(pid)!;
      const arr = dayMap.get(dk) ?? [];
      arr.push(log);
      dayMap.set(dk, arr);
    }

    const statsMap = new Map<
      string,
      { daysPresent: number; late: number; early: number; minutes: number }
    >();
    for (const p of allPersonnel) {
      const dayMap = byPersonDay.get(p.id) ?? new Map();
      let daysPresent = 0;
      let late = 0;
      let early = 0;
      let minutes = 0;
      for (const [, dayLogs] of dayMap) {
        daysPresent++;
        const cfg = resolveConfigForLogs(dayLogs, locationConfigs, globalCfg);
        const day = processDayLogs(dayLogs, cfg);
        if (day.isLate) late++;
        if (day.isEarly) early++;
        minutes += day.totalMinutes;
      }
      statsMap.set(p.id, { daysPresent, late, early, minutes });
    }

    const deptMap = new Map<string, Personnel[]>();
    for (const p of allPersonnel) {
      const dept = p.department || 'Tanımsız';
      const arr = deptMap.get(dept) ?? [];
      arr.push(p);
      deptMap.set(dept, arr);
    }

    const records = Array.from(deptMap.entries())
      .map(([dept, personnel]) => {
        let totalDaysPresent = 0;
        let totalLate = 0;
        let totalEarly = 0;
        let totalHours = 0;

        for (const p of personnel) {
          const s = statsMap.get(p.id)!;
          totalDaysPresent += s.daysPresent;
          totalLate += s.late;
          totalEarly += s.early;
          totalHours += s.minutes / 60;
        }

        const avgAttendanceRate =
          workDays > 0 && personnel.length > 0
            ? Math.round(
                (totalDaysPresent / (workDays * personnel.length)) * 10000,
              ) / 100
            : 0;

        const avgHoursPerDay =
          totalDaysPresent > 0
            ? Math.round((totalHours / totalDaysPresent) * 100) / 100
            : 0;

        return {
          department: dept,
          totalPersonnel: personnel.length,
          presentPersonnel: personnel.filter(
            (p) => (statsMap.get(p.id)?.daysPresent ?? 0) > 0,
          ).length,
          avgAttendanceRate,
          lateCount: totalLate,
          earlyLeaveCount: totalEarly,
          avgHoursPerDay,
        };
      })
      .sort((a, b) => a.department.localeCompare(b.department, 'tr'));

    return {
      startDate: startDateStr,
      endDate: endDateStr,
      workDays,
      records,
    };
  }
}
