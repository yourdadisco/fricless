import type { AIProvider, ProviderConfig } from './types.js';

export type ProviderFactory = (config: ProviderConfig) => AIProvider;

export class ProviderRegistry {
  private factories = new Map<string, ProviderFactory>();

  register(vendor: string, factory: ProviderFactory): void {
    this.factories.set(vendor, factory);
  }

  create(config: ProviderConfig): AIProvider {
    const vendor = config.vendor || 'anthropic';
    const factory = this.factories.get(vendor);
    if (!factory) throw new Error(`Unknown provider vendor: ${vendor}. Available: ${Array.from(this.factories.keys()).join(', ')}`);
    return factory(config);
  }

  has(vendor: string): boolean {
    return this.factories.has(vendor);
  }

  getAvailable(): string[] {
    return Array.from(this.factories.keys());
  }
}

// Default registry with Anthropic provider
import { AnthropicProvider } from './AnthropicProvider.js';
export const defaultRegistry = new ProviderRegistry();
defaultRegistry.register('anthropic', (config) => new AnthropicProvider(config));
