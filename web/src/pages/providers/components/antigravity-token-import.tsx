import { useState } from 'react';
import { Wand2, ChevronLeft, Loader2, CheckCircle2, AlertCircle, Key, ExternalLink, Mail, ShieldCheck, Zap } from 'lucide-react';
import { getTransport } from '@/lib/transport';
import type { AntigravityTokenValidationResult, CreateProviderData } from '@/lib/transport';
import { ANTIGRAVITY_COLOR } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const transport = getTransport();

interface AntigravityTokenImportProps {
  onBack: () => void;
  onCreateProvider: (data: CreateProviderData) => Promise<void>;
}

type ImportMode = 'oauth' | 'token';

export function AntigravityTokenImport({ onBack, onCreateProvider }: AntigravityTokenImportProps) {
  const [mode, setMode] = useState<ImportMode>('token');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [validating, setValidating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [validationResult, setValidationResult] = useState<AntigravityTokenValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 验证 token
  const handleValidate = async () => {
    if (token.trim() === '' || !token.startsWith('1//')) {
      setError('请输入有效的 refresh token（以 1// 开头）');
      return;
    }

    setValidating(true);
    setError(null);
    setValidationResult(null);

    try {
      const result = await transport.validateAntigravityToken(token.trim());
      setValidationResult(result);
      if (!result.valid) {
        setError(result.error || 'Token 验证失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败');
    } finally {
      setValidating(false);
    }
  };

  // 创建 provider
  const handleCreate = async () => {
    if (!validationResult?.valid) {
      setError('请先验证 token');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // 优先使用验证返回的邮箱，其次使用用户输入的邮箱
      const finalEmail = validationResult.userInfo?.email || email.trim() || '';
      const providerData: CreateProviderData = {
        type: 'antigravity',
        name: finalEmail || 'Antigravity Account',
        config: {
          antigravity: {
            email: finalEmail,
            refreshToken: token.trim(),
            projectID: validationResult.projectID || '',
            endpoint: validationResult.projectID
              ? `https://us-central1-aiplatform.googleapis.com/v1/projects/${validationResult.projectID}/locations/us-central1`
              : '',
          },
        },
      };
      await onCreateProvider(providerData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const isTokenValid = token.trim().startsWith('1//');

  return (
    <div className="flex flex-col h-full bg-surface-primary">
      {/* Header */}
      <div className="h-16 flex items-center gap-4 px-6 border-b border-border bg-surface-primary/80 backdrop-blur-sm sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="rounded-full hover:bg-surface-hover -ml-2"
        >
          <ChevronLeft size={20} className="text-text-secondary" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <span 
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: ANTIGRAVITY_COLOR }}
            />
            Add Antigravity Account
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-2xl mx-auto py-8 px-6 space-y-8">
          
          {/* Hero Section */}
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-2xl font-bold text-text-primary">Choose Authentication Method</h1>
            <p className="text-text-secondary mx-auto">
              Select how you want to connect your Antigravity account to access models.
            </p>
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setMode('oauth')}
              className={cn(
                "relative group p-4 rounded-xl border-2 transition-all duration-200 text-left",
                mode === 'oauth'
                  ? "border-accent bg-accent/5 shadow-sm"
                  : "border-border hover:border-accent/50 bg-surface-secondary hover:bg-surface-hover"
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    mode === 'oauth' ? "bg-accent/20 text-accent" : "bg-surface-hover text-text-secondary group-hover:text-accent"
                  )}
                >
                  <ExternalLink size={20} />
                </div>
                <div>
                  <div className={cn("font-semibold mb-1", mode === 'oauth' ? "text-accent" : "text-text-primary")}>
                    OAuth Connect
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Securely authorize via Google. Best for personal accounts.
                  </p>
                </div>
              </div>
              {mode === 'oauth' && (
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-accent" />
              )}
            </button>

            <button
              onClick={() => setMode('token')}
              className={cn(
                "relative group p-4 rounded-xl border-2 transition-all duration-200 text-left",
                mode === 'token'
                  ? "border-accent bg-accent/5 shadow-sm"
                  : "border-border hover:border-accent/50 bg-surface-secondary hover:bg-surface-hover"
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    mode === 'token' ? "bg-accent/20 text-accent" : "bg-surface-hover text-text-secondary group-hover:text-accent"
                  )}
                >
                  <Key size={20} />
                </div>
                <div>
                  <div className={cn("font-semibold mb-1", mode === 'token' ? "text-accent" : "text-text-primary")}>
                    Manual Token
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Paste your refresh token directly. Best for service accounts.
                  </p>
                </div>
              </div>
              {mode === 'token' && (
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-accent" />
              )}
            </button>
          </div>

          <div className="w-full h-px bg-border/50" />

          {/* Content Area */}
          <div className="min-h-[400px]">
            {mode === 'oauth' ? (
              <div className="bg-surface-secondary/50 rounded-2xl p-10 border border-dashed border-border text-center flex flex-col items-center justify-center h-full">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-inner"
                  style={{ backgroundColor: `${ANTIGRAVITY_COLOR}15` }}
                >
                  <Wand2 size={32} style={{ color: ANTIGRAVITY_COLOR }} />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">OAuth Authorization</h3>
                <p className="text-sm text-text-secondary mb-8 max-w-sm">
                  We will redirect you to Google to securely authorize access to your Antigravity projects.
                </p>
                <Button
                  disabled
                  variant="secondary"
                  className="gap-2 cursor-not-allowed opacity-80"
                >
                  <Loader2 size={16} className="animate-spin" />
                  Coming Soon
                </Button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-surface-secondary rounded-2xl p-6 border border-border space-y-6 shadow-sm">
                  <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                    <div className="p-2 rounded-lg bg-surface-hover">
                      <ShieldCheck size={18} className="text-text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-text-primary">Credentials</h3>
                      <p className="text-xs text-text-secondary">Enter your account details below</p>
                    </div>
                  </div>

                  {/* Email Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary flex items-center justify-between">
                      <span className="flex items-center gap-2"><Mail size={14} /> Email Address</span>
                      <span className="text-[10px] text-text-muted bg-surface-hover px-2 py-0.5 rounded-full">Optional</span>
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. user@example.com"
                      className="bg-surface-primary"
                      disabled={validating || creating}
                    />
                    <p className="text-[11px] text-text-muted pl-1">
                      Used for display purposes only. Auto-detected if valid token provided.
                    </p>
                  </div>

                  {/* Token Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                      <Key size={14} /> Refresh Token
                    </label>
                    <div className="relative">
                      <textarea
                        value={token}
                        onChange={(e) => {
                          setToken(e.target.value);
                          setValidationResult(null);
                        }}
                        placeholder="1//0xxx..."
                        className="w-full h-32 px-4 py-3 rounded-xl border border-border bg-surface-primary text-text-primary placeholder:text-text-muted font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                        disabled={validating || creating}
                      />
                      {token && (
                         <div className="absolute bottom-3 right-3 text-[10px] text-text-muted font-mono bg-surface-secondary px-2 py-1 rounded border border-border">
                           {token.length} chars
                         </div>
                      )}
                    </div>
                  </div>

                  {/* Validate Button */}
                  <Button
                    onClick={handleValidate}
                    disabled={!isTokenValid || validating || creating}
                    className="w-full font-medium"
                    variant={validationResult?.valid ? "outline" : "default"}
                  >
                    {validating ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" />
                        Validating Token...
                      </>
                    ) : validationResult?.valid ? (
                      <>
                        <CheckCircle2 size={16} className="text-success mr-2" />
                        Re-validate
                      </>
                    ) : (
                      'Validate Token'
                    )}
                  </Button>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-error/5 border border-error/20 rounded-xl p-4 flex items-start gap-3 animate-in fade-in zoom-in-95">
                    <AlertCircle size={20} className="text-error flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-error">Validation Failed</p>
                      <p className="text-xs text-error/80 mt-0.5">{error}</p>
                    </div>
                  </div>
                )}

                {/* Validation Result */}
                {validationResult?.valid && (
                  <div className="bg-success/5 border border-success/20 rounded-xl p-5 animate-in fade-in zoom-in-95">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-success/10 rounded-full">
                         <CheckCircle2 size={24} className="text-success" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="font-semibold text-text-primary">
                          Token Verified Successfully
                        </div>
                        <div className="text-sm text-text-secondary">
                          Ready to connect as <span className="font-medium text-text-primary">{validationResult.userInfo?.email || email}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-success/10">
                          {validationResult.userInfo?.name && (
                            <span className="text-xs text-text-muted bg-surface-primary px-2 py-1 rounded border border-border/50">
                              {validationResult.userInfo.name}
                            </span>
                          )}
                          {validationResult.quota?.subscriptionTier && (
                             <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-primary border border-border/50">
                               <Zap size={10} className={
                                 validationResult.quota.subscriptionTier === 'ULTRA' ? 'text-purple-500' : 'text-blue-500'
                               } />
                               <span className="text-xs font-medium text-text-secondary">
                                 {validationResult.quota.subscriptionTier} Tier
                               </span>
                             </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Create Button */}
                <div className="pt-4">
                  <Button
                    onClick={handleCreate}
                    disabled={!validationResult?.valid || creating}
                    size="lg"
                    className="w-full text-base shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all"
                  >
                    {creating ? (
                      <>
                        <Loader2 size={18} className="animate-spin mr-2" />
                        Creating Provider...
                      </>
                    ) : (
                      'Complete Setup'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
