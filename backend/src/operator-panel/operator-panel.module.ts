import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TempCardAssignment, Personnel, Device, User } from '../entities';
import { OperatorPanelController } from './operator-panel.controller';
import { OperatorPanelService } from './operator-panel.service';

@Module({
  imports: [TypeOrmModule.forFeature([TempCardAssignment, Personnel, Device, User])],
  controllers: [OperatorPanelController],
  providers: [OperatorPanelService],
})
export class OperatorPanelModule {}
