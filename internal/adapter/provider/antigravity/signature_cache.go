package antigravity

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"sync"
	"time"
)

// SignatureCache provides global caching for thought signatures
// (like Antigravity-Manager's SignatureCache and CLIProxyAPI's signature_cache)
type SignatureCache struct {
	mu sync.RWMutex

	// Layer 1: Tool ID -> Signature mapping
	toolSignatures map[string]string

	// Layer 2: Model family -> Last known signature
	familySignatures map[string]string

	// Layer 3: SessionID -> TextHash -> SignatureEntry (like CLIProxyAPI)
	sessionSignatures map[string]map[string]SignatureEntry

	// Global fallback signature
	globalSignature string
}

// SignatureEntry holds a cached signature with timestamp
type SignatureEntry struct {
	Signature string
	Timestamp time.Time
}

const (
	// SignatureCacheTTL is how long signatures are valid
	SignatureCacheTTL = 1 * time.Hour

	// MaxEntriesPerSession limits memory usage per session
	MaxEntriesPerSession = 100

	// SignatureTextHashLen is the length of the hash key
	SignatureTextHashLen = 16

	// MinSignatureLength is the minimum length for a valid thought signature
	// [Aligned with Antigravity-Manager] Uses 50 to match reference implementation
	MinSignatureLength = 50

	// SkipSignatureValidator is the sentinel value to bypass signature validation
	// Used when no valid signature is available for tool calls
	SkipSignatureValidator = "skip_thought_signature_validator"
)

var globalSignatureCache = &SignatureCache{
	toolSignatures:    make(map[string]string),
	familySignatures:  make(map[string]string),
	sessionSignatures: make(map[string]map[string]SignatureEntry),
}

// GlobalSignatureCache returns the global signature cache instance
func GlobalSignatureCache() *SignatureCache {
	return globalSignatureCache
}

// hashText creates a stable key from thinking text content
func hashText(text string) string {
	h := sha256.Sum256([]byte(text))
	return hex.EncodeToString(h[:])[:SignatureTextHashLen]
}

// CacheSessionSignature stores a signature for a given session and thinking text
// (like CLIProxyAPI's CacheSignature)
func (c *SignatureCache) CacheSessionSignature(sessionID, text, signature string) {
	if sessionID == "" || text == "" || signature == "" {
		return
	}
	if len(signature) < MinSignatureLength {
		return
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.sessionSignatures[sessionID] == nil {
		c.sessionSignatures[sessionID] = make(map[string]SignatureEntry)
	}

	session := c.sessionSignatures[sessionID]
	textHash := hashText(text)

	// Evict old entries if at capacity
	if len(session) >= MaxEntriesPerSession {
		now := time.Now()
		for key, entry := range session {
			if now.Sub(entry.Timestamp) > SignatureCacheTTL {
				delete(session, key)
			}
		}
	}

	session[textHash] = SignatureEntry{
		Signature: signature,
		Timestamp: time.Now(),
	}

	// Also update global signature
	c.globalSignature = signature
}

// GetSessionSignature retrieves a cached signature for a given session and thinking text
// (like CLIProxyAPI's GetCachedSignature)
func (c *SignatureCache) GetSessionSignature(sessionID, text string) string {
	if sessionID == "" || text == "" {
		return ""
	}

	c.mu.RLock()
	defer c.mu.RUnlock()

	session, ok := c.sessionSignatures[sessionID]
	if !ok {
		return ""
	}

	textHash := hashText(text)
	entry, exists := session[textHash]
	if !exists {
		return ""
	}

	// Check if expired
	if time.Since(entry.Timestamp) > SignatureCacheTTL {
		return ""
	}

	return entry.Signature
}

// HasValidSignature checks if a signature is valid (non-empty and long enough)
// (like CLIProxyAPI's HasValidSignature)
func HasValidSignature(signature string) bool {
	return signature != "" && len(signature) >= MinSignatureLength
}

// CacheToolSignature stores a signature for a specific tool call ID
func (c *SignatureCache) CacheToolSignature(toolID, signature string) {
	if signature == "" || len(signature) < MinSignatureLength {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.toolSignatures[toolID] = signature
}

// GetToolSignature retrieves a cached signature for a tool call ID
func (c *SignatureCache) GetToolSignature(toolID string) string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.toolSignatures[toolID]
}

// CacheThinkingFamily stores a signature with its model family for cross-model recovery
func (c *SignatureCache) CacheThinkingFamily(signature, model string) {
	if signature == "" || len(signature) < MinSignatureLength {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	family := extractModelFamily(model)
	c.familySignatures[family] = signature
	c.globalSignature = signature
}

// GetSignatureFamily returns the model family that generated a given signature
func (c *SignatureCache) GetSignatureFamily(signature string) string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	for family, sig := range c.familySignatures {
		if sig == signature {
			return family
		}
	}
	return ""
}

// GetGlobalSignature returns the most recent valid signature
func (c *SignatureCache) GetGlobalSignature() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.globalSignature
}

// SetGlobalSignature stores the global fallback signature
func (c *SignatureCache) SetGlobalSignature(signature string) {
	if signature == "" || len(signature) < MinSignatureLength {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.globalSignature = signature
}

// extractModelFamily extracts the model family from a model name
func extractModelFamily(model string) string {
	modelLower := strings.ToLower(model)

	switch {
	case strings.Contains(modelLower, "gemini-1.5"):
		return "gemini-1.5"
	case strings.Contains(modelLower, "gemini-2.0"):
		return "gemini-2.0"
	case strings.Contains(modelLower, "gemini-2.5"):
		return "gemini-2.5"
	case strings.Contains(modelLower, "gemini-3"):
		return "gemini-3"
	case strings.Contains(modelLower, "claude-3-5"):
		return "claude-3.5"
	case strings.Contains(modelLower, "claude-3-7"):
		return "claude-3.7"
	case strings.Contains(modelLower, "claude-4"):
		return "claude-4"
	default:
		return model
	}
}

// IsModelCompatible checks if two models are compatible (same family)
func IsModelCompatible(cached, target string) bool {
	c := strings.ToLower(cached)
	t := strings.ToLower(target)

	if c == t {
		return true
	}

	// Check specific families
	if strings.Contains(c, "gemini-1.5") && strings.Contains(t, "gemini-1.5") {
		return true
	}
	if strings.Contains(c, "gemini-2.0") && strings.Contains(t, "gemini-2.0") {
		return true
	}
	if strings.Contains(c, "gemini-2.5") && strings.Contains(t, "gemini-2.5") {
		return true
	}
	if strings.Contains(c, "gemini-3") && strings.Contains(t, "gemini-3") {
		return true
	}
	if strings.Contains(c, "claude-3-5") && strings.Contains(t, "claude-3-5") {
		return true
	}
	if strings.Contains(c, "claude-3-7") && strings.Contains(t, "claude-3-7") {
		return true
	}
	if strings.Contains(c, "claude-4") && strings.Contains(t, "claude-4") {
		return true
	}

	// Fallback: strict match required
	return false
}
