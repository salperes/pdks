import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '../entities';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators';
import type { AuthUser } from '../auth/interfaces';
import { OperatorPanelService } from './operator-panel.service';
import { IssueTempCardDto } from './dto/issue-temp-card.dto';

@ApiTags('Operator Panel')
@Controller('operator-panel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATOR)
export class OperatorPanelController {
  constructor(private readonly operatorPanelService: OperatorPanelService) {}

  @Post('temp-card')
  issueTempCard(
    @CurrentUser() me: AuthUser,
    @Body() dto: IssueTempCardDto,
  ) {
    return this.operatorPanelService.issueTempCard(dto, me.id);
  }

  @Post('temp-card/:id/revoke')
  revokeTempCard(
    @CurrentUser() me: AuthUser,
    @Param('id') id: string,
  ) {
    return this.operatorPanelService.revokeTempCard(id, me.id);
  }

  @Get('temp-cards')
  getAssignments(
    @Query('status') status?: string,
    @Query('locationId') locationId?: string,
  ) {
    if (status === 'active' || !status) {
      return this.operatorPanelService.getActiveAssignments(locationId);
    }
    return this.operatorPanelService.getHistory(1, 100);
  }

  @Get('temp-cards/history')
  getHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.operatorPanelService.getHistory(
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
    );
  }

  @Get('my-location')
  getMyLocation(@CurrentUser() me: AuthUser) {
    return this.operatorPanelService.getOperatorLocation(me.id);
  }
}
