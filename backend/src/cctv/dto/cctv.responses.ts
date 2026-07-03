export interface CameraAssignment {
  recorderId: string;
  recorderName: string | null;
  channelNumber: number;
}

export interface CameraResponse {
  id: string;
  status: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  macAddress: string | null;
  assetNumber: string | null;
  firmware: string | null;
  comments: string | null;
  formFactor: string | null;
  description: string | null;
  ipAddress: string | null;
  building?: string | null;
  floor?: string | null;
  rack?: string | null;
  switchName?: string | null;
  switchPort?: string | null;
  assignments?: CameraAssignment[];
}

export interface RecorderResponse {
  id: string;
  type: string;
  status: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  macAddress: string | null;
  assetNumber: string | null;
  firmware: string | null;
  comments: string | null;
  description: string | null;
  ipAddress: string | null;
  channelCapacity: number | null;
  rack: string | null;
  configuredChannels: number;
  assignedCameras: number;
}
