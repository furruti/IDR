import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CctvService } from './cctv.service';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';

@Controller('cctv')
export class CctvController {
  constructor(private readonly cctvService: CctvService) {}

  @Get('cameras')
  findAllCameras() {
    return this.cctvService.findAllCameras();
  }

  @Get('cameras/:id')
  findCameraById(@Param('id') id: string) {
    return this.cctvService.findCameraById(id);
  }

  @Post('cameras')
  createCamera(@Body() input: CreateCameraDto) {
    return this.cctvService.createCamera(input);
  }

  @Patch('cameras/:id')
  updateCamera(@Param('id') id: string, @Body() input: UpdateCameraDto) {
    return this.cctvService.updateCamera(id, input);
  }

  @Delete('cameras/:id')
  deleteCamera(@Param('id') id: string) {
    return this.cctvService.deleteCamera(id);
  }

  @Get('recorders')
  findAllRecorders() {
    return this.cctvService.findAllRecorders();
  }
}
