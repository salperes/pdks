import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily-attendance')
  getDailyAttendance(@Query('date') date: string) {
    return this.reportsService.getDailyAttendance(date);
  }

  @Get('weekly-summary')
  getWeeklySummary(@Query('date') date: string) {
    return this.reportsService.getWeeklySummary(date);
  }

  @Get('weekly-detail')
  getWeeklyDetail(@Query('date') date: string) {
    return this.reportsService.getWeeklyDetail(date);
  }

  @Get('monthly-summary')
  getMonthlySummary(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.reportsService.getMonthlySummary(+year, +month);
  }

  @Get('monthly-detail')
  getMonthlyDetail(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.reportsService.getMonthlyDetail(+year, +month);
  }

  @Get('department-summary')
  getDepartmentSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getDepartmentSummary(startDate, endDate);
  }
}
