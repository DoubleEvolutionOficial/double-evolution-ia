export type ManagedProviderId = "simulator" | "replay" | "csv" | "websocket";

export type ProviderAvailability = "available" | "coming_soon" | "unavailable";
export type ProviderRuntimeState =
  | "idle"
  | "connected"
  | "running"
  | "paused"
  | "stopped"
  | "error";

export type DataProviderStatus = {
  id: ManagedProviderId;
  label: string;
  state: ProviderRuntimeState;
  availability: ProviderAvailability;
  message: string;
  updatedAt: string;
};

export interface IDataProvider {
  connect(): void;
  disconnect(): void;
  start(): void;
  pause(): void;
  reset(): void;
  status(): DataProviderStatus;
}

export type ProviderManagerSnapshot = {
  activeProvider: ManagedProviderId;
  activeStatus: DataProviderStatus;
  providers: Record<ManagedProviderId, DataProviderStatus>;
};

export type ProviderManagerCallback = (snapshot: ProviderManagerSnapshot) => void;
