# LiquidityPro - Developer Instructions

## 🚀 Quick Start

```bash
# 1. Navigate to project
cd /mnt/okcomputer/output/app

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Build for production
npm run build

# 5. Preview production build
npm run preview
```

---

## 📁 File Organization Guide

### `/src/types/index.ts`
**Purpose**: Central type definitions
**When to modify**: Adding new data structures
```typescript
// Add new pool fields here
export interface Pool {
  id: string;
  // ... existing fields
  newField?: string;  // Add optional fields with ?
}
```

### `/src/config/index.ts`
**Purpose**: API endpoints and constants
**When to modify**: 
- Adding new API endpoints
- Changing refresh intervals
- Updating wallet configurations
```typescript
export const CONFIG = {
  REFRESH_INTERVAL: 30000,  // Change refresh timing
  NEW_API: 'https://...',    // Add new API endpoint
}
```

### `/src/services/dataService.ts`
**Purpose**: Data fetching and transformation
**Key Methods**:
- `fetchPools()`: Main aggregation entry point
- `processDLMM()`: Transforms DLMM API response
- `processDAMMv2()`: Transforms DAMM v2 API response

**Adding a new data source**:
```typescript
async fetchNewSource(): Promise<Pool[]> {
  const response = await fetch(CONFIG.NEW_API);
  const data = await response.json();
  return data.map(p => this.processNewSource(p));
}
```

### `/src/services/wsService.ts`
**Purpose**: Real-time WebSocket connections
**Key Methods**:
- `connect()`: Initialize WebSocket
- `subscribeToPool()`: Subscribe to specific pool
- `fetchPoolTransactions()`: Get historical transactions

### `/src/hooks/useAppState.tsx`
**Purpose**: Global state management
**Key State**:
- `pools`: All loaded pools
- `opportunities`: AI-filtered opportunities
- `alerts`: User alert configurations
- `filters`: Active filter settings

**Adding new state**:
```typescript
const [newState, setNewState] = useState<NewType>(initialValue);

// Add to context value
const value: AppState = {
  // ... existing
  newState,
  setNewState,
}
```

---

## 🔄 Data Flow Patterns

### Fetching Data
```
Component → useAppState → Service → API → Transform → Update State
```

Example:
```typescript
// In component
const { refresh } = useAppState();
<button onClick={refresh}>Refresh</button>

// In useAppState
const refresh = useCallback(async () => {
  const fetchedPools = await dataService.fetchPools();
  setPools(fetchedPools);
  detectOpportunitiesInternal(fetchedPools);
}, []);
```

### Real-Time Updates
```
WebSocket → wsService → onTransaction callback → Component State
```

Example:
```typescript
// In component
useEffect(() => {
  wsService.onTransaction = (poolId, tx) => {
    setTransactions(prev => [tx, ...prev]);
  };
}, []);
```

---

## 🎨 Styling Guidelines

### Using CSS Variables
```tsx
// ✅ Correct
<div className="bg-[var(--bg-card)] text-[var(--text-primary)]">

// ❌ Avoid hardcoded colors
<div className="bg-gray-900 text-white">
```

### Responsive Design
```tsx
// Mobile-first approach
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
  {/* 1 col mobile, 2 col tablet, 3 col desktop */}
</div>

// Touch targets
<button className="min-h-[44px] min-w-[44px]">
  {/* Minimum touch target size */}
</button>
```

### Premium Effects
```tsx
// Glass morphism
<div className="glass border border-white/[0.04]">

// Glow effects
<div className="glow-primary">

// Gradient text
<span className="text-gradient">
```

---

## 🧪 Testing Checklist

### Before Committing
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] No console errors in browser
- [ ] Mobile responsive (test 320px, 768px, 1440px)
- [ ] Dark mode looks correct
- [ ] Animations are smooth (60fps)

### Performance Checks
- [ ] First paint < 1s
- [ ] Interactive < 2s
- [ ] No layout shift on load
- [ ] Scroll is smooth

---

## 🐛 Debugging

### Common Issues

**Issue**: Pools not loading
```bash
# Check API status
curl https://dlmm-api.meteora.ag/pair/all | head

# Check browser console for CORS errors
```

**Issue**: WebSocket not connecting
```typescript
// Add logging in wsService.ts
connection.onerror = (e) => {
  console.error('[WS] Error:', e);
};
```

**Issue**: TypeScript errors
```bash
# Check specific file
npx tsc --noEmit src/services/dataService.ts
```

---

## 📦 Adding New Features

### Step 1: Update Types
```typescript
// src/types/index.ts
export interface NewFeature {
  id: string;
  value: number;
}
```

### Step 2: Update Config (if needed)
```typescript
// src/config/index.ts
export const CONFIG = {
  NEW_FEATURE_ENABLED: true,
}
```

### Step 3: Add Service Method
```typescript
// src/services/dataService.ts
async fetchNewFeature(): Promise<NewFeature[]> {
  // Implementation
}
```

### Step 4: Update State
```typescript
// src/hooks/useAppState.tsx
const [newFeatures, setNewFeatures] = useState<NewFeature[]>([]);

// Add to initialize()
const features = await dataService.fetchNewFeature();
setNewFeatures(features);
```

### Step 5: Create Component
```typescript
// src/components/NewFeature.tsx
export function NewFeature() {
  const { newFeatures } = useAppState();
  // JSX
}
```

### Step 6: Add to App.tsx
```typescript
import { NewFeature } from './components/NewFeature';

// In render
<NewFeature />
```

---

## 🔐 Security Checklist

- [ ] No API keys in code (use environment variables)
- [ ] No console.log of sensitive data
- [ ] Input validation on all forms
- [ ] XSS prevention (React handles most)
- [ ] CSP headers configured

---

## 📊 Performance Budget

| Resource | Budget |
|----------|--------|
| JS Bundle | < 500KB gzipped |
| CSS Bundle | < 100KB gzipped |
| Images | < 50KB each |
| API Response | < 200ms |
| Total Load | < 2s on 3G |

---

## 📝 Code Style

### Naming Conventions
- **Components**: PascalCase (`PoolCard.tsx`)
- **Hooks**: camelCase with `use` prefix (`useAppState`)
- **Services**: camelCase (`dataService`)
- **Types**: PascalCase with descriptive names (`PoolTransaction`)

### File Organization
```
src/
  components/     # UI components
  hooks/          # Custom React hooks
  services/       # Business logic
  types/          # TypeScript types
  lib/            # Utilities
  config/         # Configuration
```

---

## 🚀 Deployment

### Build Process
```bash
# Clean build
rm -rf dist
npm run build

# Verify build
ls -la dist/
```

### Environment Variables
```bash
# Create .env.local for development
VITE_HELIUS_KEY=your_key_here
VITE_JUPITER_KEY=your_key_here
```

### Deployment Checklist
- [ ] Build succeeds without errors
- [ ] All environment variables set
- [ ] API endpoints reachable
- [ ] WebSocket connects successfully
- [ ] Mobile responsive verified

---

*Version: 2.0*
*Last Updated: 2026-01-28*
