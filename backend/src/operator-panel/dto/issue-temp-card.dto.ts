import { IsString, IsOptional, IsUUID, IsArray, IsDateString, IsIn } from 'class-validator';

export class IssueTempCardDto {
  @IsUUID()
  @IsOptional()
  personnelId?: string;

  @IsString()
  @IsOptional()
  guestFirstName?: string;

  @IsString()
  @IsOptional()
  guestLastName?: string;

  @IsString()
  @IsOptional()
  guestPhone?: string;

  @IsString()
  tempCardNumber: string;

  @IsString()
  @IsIn(['forgot_card', 'guest'])
  reason: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  @IsIn(['kimlik', 'ehliyet', 'pasaport'])
  documentType?: string;

  @IsString()
  @IsOptional()
  shelfNo?: string;

  @IsUUID()
  @IsOptional()
  visitedPersonnelId?: string;

  @IsString()
  @IsOptional()
  visitReason?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  deviceIds: string[];

  @IsDateString()
  expiresAt: string;
}
