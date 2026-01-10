package domain

import (
    "errors"
    "fmt"
    "time"
)

var (
    ErrNotFound          = errors.New("not found")
    ErrAlreadyExists     = errors.New("already exists")
    ErrInvalidInput      = errors.New("invalid input")
    ErrNoRoutes          = errors.New("no routes available")
    ErrAllRoutesFailed   = errors.New("all routes failed")
    ErrFirstByteTimeout  = errors.New("first byte timeout")
    ErrStreamIdleTimeout = errors.New("stream idle timeout")
    ErrUpstreamError     = errors.New("upstream error")
    ErrFormatConversion  = errors.New("format conversion error")
    ErrUnsupportedFormat = errors.New("unsupported format")
)

// ProxyError represents an error during proxy execution
type ProxyError struct {
    Err        error
    Retryable  bool
    Message    string
    RetryAfter time.Duration // Suggested retry delay (from 429 responses)
}

func (e *ProxyError) Error() string {
    if e.Message != "" {
        return fmt.Sprintf("%s: %v", e.Message, e.Err)
    }
    return e.Err.Error()
}

func (e *ProxyError) Unwrap() error {
    return e.Err
}

func NewProxyError(err error, retryable bool) *ProxyError {
    return &ProxyError{Err: err, Retryable: retryable}
}

func NewProxyErrorWithMessage(err error, retryable bool, msg string) *ProxyError {
    return &ProxyError{Err: err, Retryable: retryable, Message: msg}
}
