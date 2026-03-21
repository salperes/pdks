import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { QueryService } from './query.service';

@ApiTags('Query')
@Controller('query')
@UseGuards(JwtAuthGuard)
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  /** GET /api/v1/query/person?q=TEXT */
  @Get('person')
  searchByPerson(@Query('q') q: string) {
    return this.queryService.searchByPerson(q);
  }

  /** GET /api/v1/query/card?number=CARD_NUM */
  @Get('card')
  searchByCard(@Query('number') number: string) {
    return this.queryService.searchByCard(number);
  }
}
