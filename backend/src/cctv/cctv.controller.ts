import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CctvService } from './cctv.service';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import { CameraResponse, InfrastructureDeviceResponse, RecorderResponse } from './dto/cctv.responses';

@Controller('cctv')
export class CctvController {
  constructor(private readonly cctvService: CctvService) {}

  @Get('cameras')
  findAllCameras(): Promise<CameraResponse[]> {
    return this.cctvService.findAllCameras();
  }

  @Get('cameras/:id')
  findCameraById(@Param('id') id: string): Promise<CameraResponse> {
    return this.cctvService.findCameraById(id);
  }

  @Post('cameras')
  createCamera(@Body() input: CreateCameraDto): Promise<CameraResponse> {
    return this.cctvService.createCamera(input);
  }

  @Patch('cameras/:id')
  updateCamera(@Param('id') id: string, @Body() input: UpdateCameraDto): Promise<CameraResponse> {
    return this.cctvService.updateCamera(id, input);
  }

  @Delete('cameras/:id')
  deleteCamera(@Param('id') id: string) {
    return this.cctvService.deleteCamera(id);
  }

  @Get('recorders')
  findAllRecorders(): Promise<RecorderResponse[]> {
    return this.cctvService.findAllRecorders();
  }

  @Get('devices')
  findAllDevices(): Promise<(CameraResponse | RecorderResponse | InfrastructureDeviceResponse)[]> {
    return this.cctvService.findAllDevices();
  }

  @Get('infrastructure-devices')
  findAllInfrastructureDevices(): Promise<InfrastructureDeviceResponse[]> {
    return this.cctvService.findAllInfrastructureDevices();
  }
}
