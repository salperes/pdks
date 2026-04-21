import { IsOptional, IsUUID, IsString, IsDateString, IsInt, Min, IsIn, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryAccessLogsDto {
  @IsUUID()
  @IsOptional()
  personnelId?: string;

  @IsUUID()
  @IsOptional()
  deviceId?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsIn(['in', 'out', 'transit'])
  @IsOptional()
  direction?: 'in' | 'out' | 'transit';

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  includeTransit?: boolean;

  @IsString()
  @IsOptional()
  search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}
