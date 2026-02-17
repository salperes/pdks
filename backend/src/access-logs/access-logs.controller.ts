import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../entities';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AccessLogsService } from './access-logs.service';
import { QueryAccessLogsDto } from './dto/query-access-logs.dto';

@Controller('access-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccessLogsController {
  constructor(private readonly accessLogsService: AccessLogsService) {}

  @Get()
  findAll(@Query() query: QueryAccessLogsDto) {
    return this.accessLogsService.findAll(query);
  }

  @Get('unknown')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  findUnknown(@Query() query: QueryAccessLogsDto) {
    return this.accessLogsService.findUnknown(query);
  }
}
