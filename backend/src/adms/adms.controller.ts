import { Controller, Get, Post, Query, Req, Res, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as express from 'express';
import { AdmsService } from './adms.service';

/**
 * ADMS (iClock) push protocol controller.
 *
 * These endpoints are called BY the ZKTeco devices, not by users.
 * No JWT auth — devices authenticate via their serial number (SN).
 *
 * Routes are at /iclock/* (excluded from the /api/v1 global prefix).
 */
@ApiTags('ADMS')
@Controller('iclock')
export class AdmsController {
  private readonly logger = new Logger(AdmsController.name);

  constructor(private readonly admsService: AdmsService) {}

  /**
   * GET /iclock/cdata?SN=xxx&options=all&pushver=2.4.1&language=xx
   *
   * Initial handshake — device requests configuration.
   */
  @Get('cdata')
  async handleCdataGet(
    @Query('SN') sn: string,
    @Query('options') options: string,
    @Res() res: express.Response,
  ): Promise<void> {
    this.logger.log(`GET /iclock/cdata SN=${sn} options=${options}`);

    if (!sn) {
      res.status(400).send('ERR: Missing SN');
      return;
    }

    const config = await this.admsService.handleHandshake(sn);
    res.set('Content-Type', 'text/plain');
    res.status(200).send(config);
  }

  /**
   * POST /iclock/cdata?SN=xxx&table=ATTLOG&Stamp=xxx
   *
   * Device pushes attendance logs (or other table data).
   * Body is plain text with tab-separated records, one per line.
   */
  @Post('cdata')
  async handleCdataPost(
    @Query('SN') sn: string,
    @Query('table') table: string,
    @Query('Stamp') stamp: string,
    @Req() req: express.Request,
    @Res() res: express.Response,
  ): Promise<void> {
    this.logger.log(`POST /iclock/cdata SN=${sn} table=${table} Stamp=${stamp}`);

    if (!sn) {
      res.status(400).send('ERR: Missing SN');
      return;
    }

    // Read raw body
    const body = typeof req.body === 'string'
      ? req.body
      : req.body?.toString?.() ?? '';

    if (table === 'ATTLOG') {
      const result = await this.admsService.handleAttendancePush(sn, body);
      res.set('Content-Type', 'text/plain');
      res.status(200).send(`OK: ${result.processed}`);
    } else if (table === 'OPERLOG') {
      // Operation log — acknowledge but don't process for now
      this.logger.debug(`OPERLOG from SN=${sn}: ${body?.substring(0, 200)}`);
      res.set('Content-Type', 'text/plain');
      res.status(200).send('OK');
    } else {
      this.logger.debug(`Unknown table=${table} from SN=${sn}`);
      res.set('Content-Type', 'text/plain');
      res.status(200).send('OK');
    }
  }

  /**
   * GET /iclock/getrequest?SN=xxx
   *
   * Device polls for pending commands.
   */
  @Get('getrequest')
  handleGetRequest(
    @Query('SN') sn: string,
    @Res() res: express.Response,
  ): void {
    if (!sn) {
      res.status(400).send('ERR: Missing SN');
      return;
    }

    const command = this.admsService.getPendingCommand(sn);
    res.set('Content-Type', 'text/plain');
    res.status(200).send(command);
  }

  /**
   * POST /iclock/devicecmd?SN=xxx
   *
   * Device reports the result of a previously sent command.
   */
  @Post('devicecmd')
  handleDeviceCmd(
    @Query('SN') sn: string,
    @Req() req: express.Request,
    @Res() res: express.Response,
  ): void {
    const body = typeof req.body === 'string'
      ? req.body
      : req.body?.toString?.() ?? '';

    this.admsService.handleCommandResult(sn, body);
    res.set('Content-Type', 'text/plain');
    res.status(200).send('OK');
  }
}
