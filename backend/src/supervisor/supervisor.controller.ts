import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../entities';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators';
import { SupervisorService } from './supervisor.service';
import type { AuthUser } from '../auth/interfaces';

@Controller('supervisor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class SupervisorController {
  constructor(private readonly supervisorService: SupervisorService) {}

  @Get('assignments')
  getAssignments(@Query('personnelId') personnelId?: string) {
    return this.supervisorService.getAssignments(personnelId || undefined);
  }

  @Get('matrix')
  getMatrix() {
    return this.supervisorService.getMatrix();
  }

  @Post('assign')
  assign(
    @CurrentUser() me: AuthUser,
    @Body() body: { personnelId: string; deviceIds: string[] },
  ) {
    return this.supervisorService.assign(
      body.personnelId,
      body.deviceIds,
      me.id,
      me.username,
    );
  }

  @Post('assign-location')
  assignLocation(
    @CurrentUser() me: AuthUser,
    @Body() body: { personnelId: string; locationId: string },
  ) {
    return this.supervisorService.assignLocation(
      body.personnelId,
      body.locationId,
      me.id,
      me.username,
    );
  }

  @Post('unassign')
  unassign(
    @CurrentUser() me: AuthUser,
    @Body() body: { personnelId: string; deviceIds: string[] },
  ) {
    return this.supervisorService.unassign(
      body.personnelId,
      body.deviceIds,
      me.id,
      me.username,
    );
  }

  @Post('bulk-assign')
  bulkAssign(
    @CurrentUser() me: AuthUser,
    @Body() body: { personnelIds: string[]; deviceIds: string[] },
  ) {
    return this.supervisorService.bulkAssign(
      body.personnelIds,
      body.deviceIds,
      me.id,
      me.username,
    );
  }

  @Post('bulk-assign-location')
  bulkAssignLocation(
    @CurrentUser() me: AuthUser,
    @Body() body: { personnelIds: string[]; locationId: string },
  ) {
    return this.supervisorService.bulkAssignLocation(
      body.personnelIds,
      body.locationId,
      me.id,
      me.username,
    );
  }
}
