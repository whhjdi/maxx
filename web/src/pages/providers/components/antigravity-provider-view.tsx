import { Wand2, Mail, ChevronLeft, Trash2 } from 'lucide-react';
import { ClientIcon } from '@/components/icons/client-icons';
import type { Provider } from '@/lib/transport';
import { ANTIGRAVITY_COLOR } from '../types';

interface AntigravityProviderViewProps {
  provider: Provider;
  onDelete: () => void;
  onClose: () => void;
}

export function AntigravityProviderView({ provider, onDelete, onClose }: AntigravityProviderViewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-[73px] flex items-center justify-between p-lg border-b border-border bg-surface-primary">
        <div className="flex items-center gap-md">
          <button
            onClick={onClose}
            className="p-1.5 -ml-1 rounded-lg hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-headline font-semibold text-text-primary">{provider.name}</h2>
            <p className="text-caption text-text-secondary">Antigravity Provider</p>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="btn bg-error/10 text-error hover:bg-error/20 flex items-center gap-2"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-lg">
        <div className="container mx-auto max-w-[1600px] space-y-8">
          
          {/* Info Card */}
          <div className="bg-surface-secondary rounded-xl p-6 border border-border">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: `${ANTIGRAVITY_COLOR}15` }}
                >
                  <Wand2 size={32} style={{ color: ANTIGRAVITY_COLOR }} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-text-primary">{provider.name}</h3>
                  <div className="text-sm text-text-secondary flex items-center gap-1.5 mt-1">
                    <Mail size={14} />
                    {provider.config?.antigravity?.email || 'Unknown'}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1 text-right">
                <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold">Project ID</div>
                <div className="text-sm font-mono text-text-primary bg-surface-primary px-2 py-1 rounded border border-border/50">
                  {provider.config?.antigravity?.projectID || '-'}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border/50 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-1.5">Endpoint</div>
                <div className="font-mono text-sm text-text-primary break-all">
                  {provider.config?.antigravity?.endpoint || '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Supported Clients */}
          <div>
            <h4 className="text-lg font-semibold text-text-primary mb-4 border-b border-border pb-2">Supported Clients</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {provider.supportedClientTypes?.length > 0 ? (
                provider.supportedClientTypes.map((ct) => (
                  <div key={ct} className="flex items-center gap-3 bg-surface-primary border border-border rounded-xl p-4 shadow-sm">
                    <ClientIcon type={ct} size={28} />
                    <div>
                      <div className="text-sm font-semibold text-text-primary capitalize">{ct}</div>
                      <div className="text-xs text-text-secondary">Enabled</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-8 text-text-muted bg-surface-secondary/30 rounded-xl border border-dashed border-border">
                  No clients configured
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
