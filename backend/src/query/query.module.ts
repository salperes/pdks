import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Personnel, AccessLog } from '../entities';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';

@Module({
  imports: [TypeOrmModule.forFeature([Personnel, AccessLog])],
  controllers: [QueryController],
  providers: [QueryService],
})
export class QueryModule {}
