package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/Bowl42/maxx-next/internal/domain"
	"github.com/Bowl42/maxx-next/internal/repository"
)

// AdminHandler handles admin API requests
type AdminHandler struct {
	providerRepo        repository.ProviderRepository
	routeRepo           repository.RouteRepository
	projectRepo         repository.ProjectRepository
	sessionRepo         repository.SessionRepository
	retryConfigRepo     repository.RetryConfigRepository
	routingStrategyRepo repository.RoutingStrategyRepository
	proxyRequestRepo    repository.ProxyRequestRepository
	settingRepo         repository.SystemSettingRepository
	serverAddr          string // Server address for proxy status
}

// NewAdminHandler creates a new admin handler
func NewAdminHandler(
	providerRepo repository.ProviderRepository,
	routeRepo repository.RouteRepository,
	projectRepo repository.ProjectRepository,
	sessionRepo repository.SessionRepository,
	retryConfigRepo repository.RetryConfigRepository,
	routingStrategyRepo repository.RoutingStrategyRepository,
	proxyRequestRepo repository.ProxyRequestRepository,
	settingRepo repository.SystemSettingRepository,
	serverAddr string,
) *AdminHandler {
	return &AdminHandler{
		providerRepo:        providerRepo,
		routeRepo:           routeRepo,
		projectRepo:         projectRepo,
		sessionRepo:         sessionRepo,
		retryConfigRepo:     retryConfigRepo,
		routingStrategyRepo: routingStrategyRepo,
		proxyRequestRepo:    proxyRequestRepo,
		settingRepo:         settingRepo,
		serverAddr:          serverAddr,
	}
}

// ServeHTTP routes admin requests
func (h *AdminHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/admin")
	path = strings.TrimSuffix(path, "/")

	parts := strings.Split(path, "/")
	if len(parts) < 2 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	resource := parts[1]
	var id uint64
	if len(parts) > 2 && parts[2] != "" {
		id, _ = strconv.ParseUint(parts[2], 10, 64)
	}

	switch resource {
	case "providers":
		h.handleProviders(w, r, id)
	case "routes":
		h.handleRoutes(w, r, id)
	case "projects":
		h.handleProjects(w, r, id)
	case "sessions":
		h.handleSessions(w, r)
	case "retry-configs":
		h.handleRetryConfigs(w, r, id)
	case "routing-strategies":
		h.handleRoutingStrategies(w, r, id)
	case "requests":
		h.handleProxyRequests(w, r, id)
	case "settings":
		h.handleSettings(w, r, parts)
	case "proxy-status":
		h.handleProxyStatus(w, r)
	case "logs":
		h.handleLogs(w, r)
	default:
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	}
}

// Provider handlers
func (h *AdminHandler) handleProviders(w http.ResponseWriter, r *http.Request, id uint64) {
	switch r.Method {
	case http.MethodGet:
		if id > 0 {
			provider, err := h.providerRepo.GetByID(id)
			if err != nil {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "provider not found"})
				return
			}
			writeJSON(w, http.StatusOK, provider)
		} else {
			providers, err := h.providerRepo.List()
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, providers)
		}
	case http.MethodPost:
		var provider domain.Provider
		if err := json.NewDecoder(r.Body).Decode(&provider); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if err := h.providerRepo.Create(&provider); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		// Auto-create routes for each supported client type
		h.syncProviderRoutes(&provider, nil)
		writeJSON(w, http.StatusCreated, provider)
	case http.MethodPut:
		if id == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
			return
		}
		// Get old provider to compare supportedClientTypes
		// Make a copy of old SupportedClientTypes before update to avoid cache mutation issues
		var oldSupportedClientTypes []domain.ClientType
		if oldProvider, err := h.providerRepo.GetByID(id); err == nil && oldProvider != nil {
			oldSupportedClientTypes = make([]domain.ClientType, len(oldProvider.SupportedClientTypes))
			copy(oldSupportedClientTypes, oldProvider.SupportedClientTypes)
		}

		var provider domain.Provider
		if err := json.NewDecoder(r.Body).Decode(&provider); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		provider.ID = id
		if err := h.providerRepo.Update(&provider); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		// Sync routes based on supportedClientTypes changes
		h.syncProviderRoutesWithOldTypes(&provider, oldSupportedClientTypes)
		writeJSON(w, http.StatusOK, provider)
	case http.MethodDelete:
		if id == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
			return
		}
		// Delete related routes first
		routes, _ := h.routeRepo.List()
		for _, route := range routes {
			if route.ProviderID == id {
				h.routeRepo.Delete(route.ID)
			}
		}
		if err := h.providerRepo.Delete(id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusNoContent, nil)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// Route handlers
func (h *AdminHandler) handleRoutes(w http.ResponseWriter, r *http.Request, id uint64) {
	switch r.Method {
	case http.MethodGet:
		if id > 0 {
			route, err := h.routeRepo.GetByID(id)
			if err != nil {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "route not found"})
				return
			}
			writeJSON(w, http.StatusOK, route)
		} else {
			routes, err := h.routeRepo.List()
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, routes)
		}
	case http.MethodPost:
		var route domain.Route
		if err := json.NewDecoder(r.Body).Decode(&route); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if err := h.routeRepo.Create(&route); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, route)
	case http.MethodPut:
		if id == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
			return
		}
		var route domain.Route
		if err := json.NewDecoder(r.Body).Decode(&route); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		route.ID = id
		if err := h.routeRepo.Update(&route); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, route)
	case http.MethodDelete:
		if id == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
			return
		}
		if err := h.routeRepo.Delete(id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusNoContent, nil)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// Project handlers
func (h *AdminHandler) handleProjects(w http.ResponseWriter, r *http.Request, id uint64) {
	switch r.Method {
	case http.MethodGet:
		if id > 0 {
			project, err := h.projectRepo.GetByID(id)
			if err != nil {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "project not found"})
				return
			}
			writeJSON(w, http.StatusOK, project)
		} else {
			projects, err := h.projectRepo.List()
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, projects)
		}
	case http.MethodPost:
		var project domain.Project
		if err := json.NewDecoder(r.Body).Decode(&project); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if err := h.projectRepo.Create(&project); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, project)
	case http.MethodPut:
		if id == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
			return
		}
		var project domain.Project
		if err := json.NewDecoder(r.Body).Decode(&project); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		project.ID = id
		if err := h.projectRepo.Update(&project); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, project)
	case http.MethodDelete:
		if id == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
			return
		}
		if err := h.projectRepo.Delete(id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusNoContent, nil)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// Session handlers
func (h *AdminHandler) handleSessions(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		sessions, err := h.sessionRepo.List()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, sessions)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// RetryConfig handlers
func (h *AdminHandler) handleRetryConfigs(w http.ResponseWriter, r *http.Request, id uint64) {
	switch r.Method {
	case http.MethodGet:
		if id > 0 {
			config, err := h.retryConfigRepo.GetByID(id)
			if err != nil {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "retry config not found"})
				return
			}
			writeJSON(w, http.StatusOK, config)
		} else {
			configs, err := h.retryConfigRepo.List()
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, configs)
		}
	case http.MethodPost:
		var config domain.RetryConfig
		if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if err := h.retryConfigRepo.Create(&config); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, config)
	case http.MethodPut:
		if id == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
			return
		}
		var config domain.RetryConfig
		if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		config.ID = id
		if err := h.retryConfigRepo.Update(&config); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, config)
	case http.MethodDelete:
		if id == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
			return
		}
		if err := h.retryConfigRepo.Delete(id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusNoContent, nil)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// RoutingStrategy handlers
func (h *AdminHandler) handleRoutingStrategies(w http.ResponseWriter, r *http.Request, id uint64) {
	switch r.Method {
	case http.MethodGet:
		if id > 0 {
			strategy, err := h.routingStrategyRepo.GetByProjectID(id)
			if err != nil {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "routing strategy not found"})
				return
			}
			writeJSON(w, http.StatusOK, strategy)
		} else {
			strategies, err := h.routingStrategyRepo.List()
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, strategies)
		}
	case http.MethodPost:
		var strategy domain.RoutingStrategy
		if err := json.NewDecoder(r.Body).Decode(&strategy); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if err := h.routingStrategyRepo.Create(&strategy); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, strategy)
	case http.MethodPut:
		if id == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
			return
		}
		var strategy domain.RoutingStrategy
		if err := json.NewDecoder(r.Body).Decode(&strategy); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		strategy.ID = id
		if err := h.routingStrategyRepo.Update(&strategy); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, strategy)
	case http.MethodDelete:
		if id == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
			return
		}
		if err := h.routingStrategyRepo.Delete(id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusNoContent, nil)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// ProxyRequest handlers
func (h *AdminHandler) handleProxyRequests(w http.ResponseWriter, r *http.Request, id uint64) {
	switch r.Method {
	case http.MethodGet:
		if id > 0 {
			req, err := h.proxyRequestRepo.GetByID(id)
			if err != nil {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "proxy request not found"})
				return
			}
			writeJSON(w, http.StatusOK, req)
		} else {
			// Get limit and offset from query params
			limit := 100
			offset := 0
			if l := r.URL.Query().Get("limit"); l != "" {
				limit, _ = strconv.Atoi(l)
			}
			if o := r.URL.Query().Get("offset"); o != "" {
				offset, _ = strconv.Atoi(o)
			}
			requests, err := h.proxyRequestRepo.List(limit, offset)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, requests)
		}
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// Settings handlers
func (h *AdminHandler) handleSettings(w http.ResponseWriter, r *http.Request, parts []string) {
	// Extract key from path: /admin/settings/key
	var key string
	if len(parts) > 2 {
		key = parts[2]
	}

	switch r.Method {
	case http.MethodGet:
		if key != "" {
			// Get single setting
			value, err := h.settingRepo.Get(key)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]string{"key": key, "value": value})
		} else {
			// Get all settings
			settings, err := h.settingRepo.GetAll()
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, settings)
		}
	case http.MethodPut, http.MethodPost:
		if key == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "key required"})
			return
		}
		var body struct {
			Value string `json:"value"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if err := h.settingRepo.Set(key, body.Value); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"key": key, "value": body.Value})
	case http.MethodDelete:
		if key == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "key required"})
			return
		}
		if err := h.settingRepo.Delete(key); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusNoContent, nil)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// Proxy status handler
func (h *AdminHandler) handleProxyStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	// Parse port from serverAddr (e.g., ":9880" or "0.0.0.0:9880")
	addr := h.serverAddr
	port := 9880 // default
	if idx := strings.LastIndex(addr, ":"); idx >= 0 {
		if p, err := strconv.Atoi(addr[idx+1:]); err == nil {
			port = p
		}
	}

	// Build display address
	displayAddr := "localhost"
	if port != 80 {
		displayAddr = "localhost:" + strconv.Itoa(port)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"running": true,
		"address": displayAddr,
		"port":    port,
	})
}

// syncProviderRoutes syncs routes based on provider's supportedClientTypes
// - Creates routes for newly added client types (position at end, enabled by default)
// - Deletes routes for removed client types
func (h *AdminHandler) syncProviderRoutes(provider *domain.Provider, oldProvider *domain.Provider) {
	var oldClientTypes []domain.ClientType
	if oldProvider != nil {
		oldClientTypes = oldProvider.SupportedClientTypes
	}
	h.syncProviderRoutesWithOldTypes(provider, oldClientTypes)
}

// syncProviderRoutesWithOldTypes syncs native routes using explicit old client types slice
// - Only manages native routes (IsNative = true), converted routes are not affected
// - Creates native routes for newly added client types
// - Deletes native routes for removed client types
func (h *AdminHandler) syncProviderRoutesWithOldTypes(provider *domain.Provider, oldClientTypes []domain.ClientType) {
	// Get all existing routes for this provider
	allRoutes, _ := h.routeRepo.List()

	// Build set of old client types
	oldClientTypesSet := make(map[domain.ClientType]bool)
	for _, ct := range oldClientTypes {
		oldClientTypesSet[ct] = true
	}

	// Build set of new client types
	newClientTypes := make(map[domain.ClientType]bool)
	for _, ct := range provider.SupportedClientTypes {
		newClientTypes[ct] = true
	}

	// Find NATIVE routes for this provider (only manage native routes)
	providerNativeRoutes := make(map[domain.ClientType]*domain.Route)
	for _, route := range allRoutes {
		if route.ProviderID == provider.ID && route.IsNative {
			providerNativeRoutes[route.ClientType] = route
		}
	}

	// Delete native routes for removed client types
	for ct := range oldClientTypesSet {
		if !newClientTypes[ct] {
			if route, exists := providerNativeRoutes[ct]; exists {
				h.routeRepo.Delete(route.ID)
			}
		}
	}

	// Create native routes for added client types
	for ct := range newClientTypes {
		if !oldClientTypesSet[ct] {
			// Calculate max position for this client type
			maxPosition := 0
			for _, route := range allRoutes {
				if route.ClientType == ct && route.Position > maxPosition {
					maxPosition = route.Position
				}
			}

			// Create new native route at the end, enabled by default
			newRoute := &domain.Route{
				IsEnabled:     true,
				IsNative:      true, // 原生支持
				ProjectID:     0,    // Global
				ClientType:    ct,
				ProviderID:    provider.ID,
				Position:      maxPosition + 1,
				RetryConfigID: 0, // Use default
			}
			h.routeRepo.Create(newRoute)
		}
	}
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

// Logs handler - read last N lines from log file
func (h *AdminHandler) handleLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	// Get limit from query params, default 100
	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	// Cap at 1000 to prevent excessive memory usage
	if limit > 1000 {
		limit = 1000
	}

	lines, err := ReadLastNLines(limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"lines": lines,
		"count": len(lines),
	})
}
