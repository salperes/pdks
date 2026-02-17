import { IsString, IsOptional, IsInt, IsUUID, IsEnum } from 'class-validator';
import { DeviceDirection } from '../../entities';

export class CreateDeviceDto {
  @IsString()
  name: string;

  @IsString()
  ipAddress: string;

  @IsInt()
  @IsOptional()
  port?: number;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsEnum(DeviceDirection)
  @IsOptional()
  direction?: DeviceDirection;

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsString()
  @IsOptional()
  commKey?: string;
}
