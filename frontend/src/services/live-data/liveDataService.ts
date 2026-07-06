import {
  LiveDataCallback,
  LiveDataProviderContract,
  LiveDataServiceContract,
} from "./types";
import { MockDataProvider } from "./providers/mockLiveDataProvider";

export class LiveDataService implements LiveDataServiceContract {
  private readonly provider: LiveDataProviderContract;

  constructor(provider: LiveDataProviderContract = new MockDataProvider()) {
    this.provider = provider;
  }

  connect(): void {
    this.provider.connect();
  }

  disconnect(): void {
    this.provider.disconnect();
  }

  isConnected(): boolean {
    return this.provider.isConnected();
  }

  getLatestEvents() {
    return this.provider.getLatestEvents();
  }

  subscribe(callback: LiveDataCallback): () => void {
    return this.provider.subscribe(callback);
  }
}

export const liveDataService = new LiveDataService();