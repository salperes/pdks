import { IsString, IsOptional, IsEmail } from 'class-validator';

export class CreatePersonnelDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  cardNumber: string;

  @IsString()
  @IsOptional()
  tcKimlikNo?: string;

  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
