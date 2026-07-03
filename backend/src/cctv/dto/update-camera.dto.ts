import { IsIP, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateCameraDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @Matches(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/)
  macAddress?: string;

  @IsOptional()
  @IsString()
  assetNumber?: string;

  @IsOptional()
  @IsString()
  firmware?: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsString()
  formFactor?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIP()
  ipAddress?: string;
}
