import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';
import { useProxyRequest, useProxyUpstreamAttempts, useProxyRequestUpdates } from '@/hooks/queries';
import { ArrowLeft, Clock, Zap, AlertCircle, Server, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { statusVariant } from './index';
import type { ProxyUpstreamAttempt } from '@/lib/transport';

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: request, isLoading, error } = useProxyRequest(Number(id));
  const { data: attempts } = useProxyUpstreamAttempts(Number(id));
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('request');

  useProxyRequestUpdates();

  const selectedAttempt = attempts?.find(a => a.id === selectedAttemptId) ?? attempts?.[0];

  const formatDuration = (ns: number) => {
    const ms = ns / 1_000_000;
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr || dateStr === '0001-01-01T00:00:00Z') return '-';
    return new Date(dateStr).toLocaleTimeString();
  };

  const formatJSON = (obj: unknown): string => {
    if (!obj) return '-';
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'IN_PROGRESS':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => navigate('/requests')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h3 className="text-lg font-semibold">Request Not Found</h3>
            <p className="text-gray-500">The request doesn't exist or has been deleted.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/requests')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{request.requestModel || 'Unknown Model'}</h2>
              <Badge variant={statusVariant[request.status]}>{request.status}</Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="font-mono">#{request.id}</span>
              <span>{request.clientType}</span>
              <span>{formatTime(request.startTime)}</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="font-medium">{request.duration ? formatDuration(request.duration) : '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-gray-400" />
            <span className="font-medium">
              {request.inputTokenCount + request.outputTokenCount > 0
                ? `${request.inputTokenCount}/${request.outputTokenCount}`
                : '-'}
            </span>
          </div>
          {request.cost > 0 && (
            <span className="font-medium text-green-600">${request.cost.toFixed(4)}</span>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {request.error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <pre className="whitespace-pre-wrap break-words font-mono text-sm text-red-600 dark:text-red-400">
            {request.error}
          </pre>
        </div>
      )}

      {/* Main Content: Attempts */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gray-50 py-3 dark:bg-gray-900">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            Upstream Attempts
            {attempts && attempts.length > 0 && (
              <Badge variant="default" className="ml-1">{attempts.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {attempts && attempts.length > 0 ? (
            <div className="flex divide-x">
              {/* Left: Attempts List */}
              <div className="w-56 shrink-0 divide-y">
                {attempts.map((attempt: ProxyUpstreamAttempt, index: number) => (
                  <div
                    key={attempt.id}
                    onClick={() => setSelectedAttemptId(attempt.id)}
                    className={`cursor-pointer p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      selectedAttempt?.id === attempt.id ? 'bg-blue-50 dark:bg-blue-950' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(attempt.status)}
                        <span className="text-sm font-medium">Attempt {index + 1}</span>
                      </div>
                      {attempt.responseInfo && (
                        <Badge
                          variant={attempt.responseInfo.status >= 400 ? 'danger' : 'success'}
                          className="text-xs"
                        >
                          {attempt.responseInfo.status}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Provider #{attempt.providerID}
                    </div>
                    {(attempt.inputTokenCount > 0 || attempt.outputTokenCount > 0) && (
                      <div className="mt-1 text-xs text-gray-400">
                        {attempt.inputTokenCount}/{attempt.outputTokenCount} tokens
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Right: Detail Panel */}
              <div className="min-w-0 flex-1">
                {selectedAttempt ? (
                  <>
                    {/* Tabs */}
                    <div className="flex border-b">
                      <button
                        onClick={() => setActiveTab('request')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          activeTab === 'request'
                            ? 'border-b-2 border-blue-500 text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Request
                      </button>
                      <button
                        onClick={() => setActiveTab('response')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          activeTab === 'response'
                            ? 'border-b-2 border-blue-500 text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Response
                      </button>
                    </div>

                    {/* Tab Content */}
                    <div className="p-4">
                      {activeTab === 'request' && selectedAttempt.requestInfo && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Badge variant="info">{selectedAttempt.requestInfo.method}</Badge>
                            <code className="flex-1 truncate rounded bg-gray-100 px-2 py-1 font-mono text-xs dark:bg-gray-800">
                              {selectedAttempt.requestInfo.url}
                            </code>
                          </div>
                          <div>
                            <h5 className="mb-2 text-xs font-medium uppercase text-gray-500">Headers</h5>
                            <pre className="max-h-40 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-xs dark:bg-gray-900">
                              {formatJSON(selectedAttempt.requestInfo.headers)}
                            </pre>
                          </div>
                          {selectedAttempt.requestInfo.body && (
                            <div>
                              <h5 className="mb-2 text-xs font-medium uppercase text-gray-500">Body</h5>
                              <pre className="max-h-80 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-xs dark:bg-gray-900">
                                {(() => {
                                  try {
                                    return formatJSON(JSON.parse(selectedAttempt.requestInfo.body));
                                  } catch {
                                    return selectedAttempt.requestInfo.body;
                                  }
                                })()}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'request' && !selectedAttempt.requestInfo && (
                        <div className="py-12 text-center text-gray-400">
                          No request data available
                        </div>
                      )}

                      {activeTab === 'response' && selectedAttempt.responseInfo && (
                        <div className="space-y-4">
                          <div>
                            <Badge variant={selectedAttempt.responseInfo.status >= 400 ? 'danger' : 'success'}>
                              {selectedAttempt.responseInfo.status}
                            </Badge>
                          </div>
                          <div>
                            <h5 className="mb-2 text-xs font-medium uppercase text-gray-500">Headers</h5>
                            <pre className="max-h-40 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-xs dark:bg-gray-900">
                              {formatJSON(selectedAttempt.responseInfo.headers)}
                            </pre>
                          </div>
                          {selectedAttempt.responseInfo.body && (
                            <div>
                              <h5 className="mb-2 text-xs font-medium uppercase text-gray-500">Body</h5>
                              <pre className="max-h-80 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-xs dark:bg-gray-900">
                                {(() => {
                                  try {
                                    return formatJSON(JSON.parse(selectedAttempt.responseInfo.body));
                                  } catch {
                                    return selectedAttempt.responseInfo.body;
                                  }
                                })()}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'response' && !selectedAttempt.responseInfo && (
                        <div className="py-12 text-center text-gray-400">
                          No response data available
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    Select an attempt to view details
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-400">
              No upstream attempts recorded
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Info (Collapsible) */}
      <details className="group">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <span className="transition-transform group-open:rotate-90">▶</span>
            <span>More Details</span>
          </div>
        </summary>
        <Card className="mt-2">
          <CardContent className="p-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-gray-500">Request ID</dt>
                <dd className="mt-0.5 font-mono text-xs break-all">{request.requestID || '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Session ID</dt>
                <dd className="mt-0.5 font-mono text-xs break-all">{request.sessionID || '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Response Model</dt>
                <dd className="mt-0.5 font-mono text-xs">{request.responseModel || '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Cache</dt>
                <dd className="mt-0.5">
                  {request.cacheReadCount + request.cacheWriteCount > 0
                    ? `${request.cacheReadCount} read / ${request.cacheWriteCount} write`
                    : '-'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </details>
    </div>
  );
}
