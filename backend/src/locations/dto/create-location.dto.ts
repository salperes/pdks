import { IsString, IsOptional, IsBoolean, IsInt, Min, Max, Matches } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  workStartTime?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  workEndTime?: string;

  @IsBoolean()
  @IsOptional()
  isFlexible?: boolean;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(240)
  flexGraceMinutes?: number;
}
