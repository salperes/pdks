import { IsString, IsOptional, IsBoolean, IsInt, IsIn, Min, Max, Matches } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateWorkScheduleDto {
  @IsString()
  name: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'workStartTime must be HH:MM format' })
  workStartTime: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'workEndTime must be HH:MM format' })
  workEndTime: string;

  @IsBoolean()
  @IsOptional()
  isFlexible?: boolean;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(240)
  flexGraceMinutes?: number;

  @IsString()
  @IsOptional()
  @IsIn(['firstLast', 'paired'])
  calculationMode?: 'firstLast' | 'paired';
}

export class UpdateWorkScheduleDto extends PartialType(CreateWorkScheduleDto) {}
