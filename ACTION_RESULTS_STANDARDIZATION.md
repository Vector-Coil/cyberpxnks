# Action Results Standardization Plan

## Problem Summary

Action results across the app (Explore, Scout, Breach, Gigs, Encounters, Overnet Scan) currently use inconsistent patterns and UI structures. The Breach results specifically have **two dismiss buttons** - one replacing the action button and another at the bottom of the results section - creating UX confusion.

## Current Inconsistencies

### Breach Results (PoiCard.tsx)
- **TWO DISMISS buttons**: One replaces the "BREACH" button (line 100) AND another at the bottom of results (line 214)
- Results appear inline within the card below a border separator
- Encounter handling is embedded within the results structure

### Scout Results (city/[zone]/page.tsx)
- Single DISMISS button at bottom of results
- Uses modal-base styling structure
- Results shown inline in action card
- Consistent encounter handling pattern

### Explore Results (city/page.tsx)  
- Single DISMISS button at bottom of results
- Uses modal-base styling structure
- Results shown inline in action card
- Same encounter handling pattern as Scout

### Overnet Scan Results (grid/page.tsx)
- Single DISMISS button at bottom
- Uses modal-base styling structure
- Results shown inline in action card
- Same encounter handling pattern

### Encounter Results (encounters/[id]/page.tsx)
- Single DISMISS button
- Full page view (not inline)
- Different pattern entirely

## Recommended Standardization

### Pattern A: Inline Results (Preferred for Most Actions)

**States:**
1. **Ready State** → Action button (EXPLORE, SCOUT, BREACH, etc.)
2. **In Progress State** → Status button + timer (e.g., "SCOUTING IN PROGRESS")
3. **Completed State** → "VIEW RESULTS" button
4. **Results State** → Results display + single DISMISS button

**Structure:**
```tsx
{results ? (
  // Results State
  <div>
    <div className="modal-base mb-2">
      <div className="modal-title mb-2">[ACTION] RESULTS</div>
      <div className="modal-body-data space-y-2">
        {/* XP, gains, discoveries */}
      </div>
    </div>
    
    {/* Discovery cards (if applicable) */}
    {discovery && (
      <div className="modal-base mb-2 border-2 border-bright-green/50">
        <div className="modal-title mb-2 text-bright-green">✨ DISCOVERY</div>
        <div className="modal-body-data">...</div>
      </div>
    )}
    
    {/* Encounter card (if applicable) */}
    {encounter && (
      <div className="modal-base mb-2 border-2 border-yellow-500/50">
        <div className="modal-title mb-2 text-yellow-400">⚠ ENCOUNTER DETECTED</div>
        <div className="modal-body-data">...</div>
      </div>
    )}
    
    {/* Single dismiss section */}
    {encounter ? (
      <div className="space-y-2">
        <button className="btn-cx btn-cx-primary btn-cx-full">
          OPEN ENCOUNTER
        </button>
        <button className="btn-cx btn-cx-secondary btn-cx-full">
          RUN AWAY (DISMISS)
        </button>
      </div>
    ) : (
      <button className="btn-cx btn-cx-secondary btn-cx-full">
        DISMISS
      </button>
    )}
  </div>
) : inProgress ? (
  // In Progress State
  <div>
    <button className="btn-cx btn-cx-pause btn-cx-full">
      {isComplete ? 'VIEW RESULTS' : '[ACTION] IN PROGRESS'}
    </button>
    <div className="text-white text-center text-xs">{timer}</div>
  </div>
) : (
  // Ready State
  <button className="btn-cx btn-cx-primary btn-cx-full">
    [ACTION NAME]
  </button>
)}
```

### Key Principles

1. **Never show the action button when results are visible**
2. **Only one dismiss mechanism** - single DISMISS button at bottom of results
3. **Consistent modal-base styling** for all result cards
4. **Consistent encounter handling** - always show "OPEN ENCOUNTER" + "RUN AWAY" when encounter exists
5. **Dismissing closes results** and returns to ready state
6. **Visual hierarchy**: Results → Discoveries → Encounters → Actions

## Proposed Component Architecture

### Option 1: Generic ActionResultsCard Component

Create a reusable component that handles all action result patterns:

```tsx
// components/ActionResultsCard.tsx
interface ActionResultsCardProps {
  actionName: string;
  xpGained: number;
  gainsData?: string;
  discovery?: {
    type: 'zone' | 'poi' | 'item' | 'subnet';
    name: string;
    description?: string;
    details?: Record<string, any>;
  };
  encounter?: {
    id: number;
    name: string;
    type: string;
    sentiment: string;
  };
  onDismiss: () => void;
}

export function ActionResultsCard({
  actionName,
  xpGained,
  gainsData,
  discovery,
  encounter,
  onDismiss
}: ActionResultsCardProps) {
  return (
    <div>
      {/* Main results */}
      <div className="modal-base mb-2">
        <div className="modal-title mb-2">{actionName.toUpperCase()} RESULTS</div>
        <div className="modal-body-data space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Gained XP</span>
            <span className="pill-cloud-gray">{xpGained} XP</span>
          </div>
          {discovery && (
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Discovery</span>
              <span className="pill-bright-green">{discovery.name}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Discovery detail card */}
      {discovery && (
        <DiscoveryCard discovery={discovery} />
      )}
      
      {/* Encounter card */}
      {encounter && (
        <EncounterCard encounter={encounter} />
      )}
      
      {/* Dismiss actions */}
      <ActionButtons encounter={encounter} onDismiss={onDismiss} />
    </div>
  );
}
```

### Option 2: Action State Machine Hook

Create a hook that manages action states uniformly:

```tsx
// hooks/useActionState.ts
export function useActionState(actionType: ActionType) {
  const [state, setState] = useState<'ready' | 'inProgress' | 'completed' | 'results'>('ready');
  const [results, setResults] = useState<any>(null);
  const [activeAction, setActiveAction] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  
  // State transitions
  const startAction = async () => { /* ... */ };
  const viewResults = async () => { /* ... */ };
  const dismissResults = async () => { /* ... */ };
  
  return {
    state,
    results,
    activeAction,
    timeRemaining,
    actions: { startAction, viewResults, dismissResults }
  };
}
```

### Option 3: Hybrid Approach (RECOMMENDED)

1. **Create shared subcomponents:**
   - `ActionResultsSummary` - XP and basic gains
   - `DiscoveryCard` - Unified discovery display
   - `EncounterAlert` - Unified encounter display
   - `ActionDismissButtons` - Consistent dismiss/encounter buttons

2. **Keep action-specific containers** but use shared components within them

3. **Create a standardized data structure:**
```tsx
interface ActionResults {
  historyId: number;
  actionType: 'explore' | 'scout' | 'breach' | 'scan' | 'gig';
  xpGained: number;
  gainsText?: string;
  discovery?: {
    type: 'zone' | 'district' | 'poi' | 'item' | 'subnet' | 'contact';
    name: string;
    description?: string;
    metadata?: Record<string, any>;
  };
  encounter?: {
    id: number;
    name: string;
    type: string;
    sentiment: string;
    sentimentColor?: string;
  };
  levelUp?: {
    leveledUp: boolean;
    newLevel: number;
  };
}
```

## Implementation Priority

### Phase 1: Fix Critical Issues (Immediate)
- [ ] **Remove duplicate dismiss button from PoiCard** (line 100)
- [ ] Keep only the bottom dismiss button (line 214)
- [ ] Verify all actions have single dismiss point

### Phase 2: Create Shared Components (Short-term)
- [ ] Create `ActionResultsSummary` component
- [ ] Create `DiscoveryCard` component  
- [ ] Create `EncounterAlert` component
- [ ] Create `ActionDismissButtons` component

### Phase 3: Refactor Existing Actions (Medium-term)
- [ ] Refactor Explore to use shared components
- [ ] Refactor Scout to use shared components
- [ ] Refactor Breach to use shared components
- [ ] Refactor Overnet Scan to use shared components
- [ ] Refactor Gigs to use shared components

### Phase 4: Create Unified Hook (Long-term)
- [ ] Create `useActionState` hook for state management
- [ ] Migrate all actions to use the hook
- [ ] Add comprehensive testing

## Benefits of Standardization

1. **Consistent UX** - Users learn one pattern
2. **Easier Maintenance** - Change logic in one place
3. **Reduced Bugs** - Fewer places for inconsistencies
4. **Better Testing** - Test components independently
5. **Faster Development** - Copy-paste pattern for new actions
6. **Better Accessibility** - Consistent button labeling and structure

## Files to Update

### Immediate (Phase 1)
- `src/components/PoiCard.tsx` - Remove duplicate dismiss button

### Short-term (Phase 2-3)
- `src/components/ActionResultsSummary.tsx` (new)
- `src/components/DiscoveryCard.tsx` (new)
- `src/components/EncounterAlert.tsx` (new)
- `src/components/ActionDismissButtons.tsx` (new)
- `src/app/city/page.tsx` - Refactor Explore
- `src/app/city/[zone]/page.tsx` - Refactor Scout
- `src/app/city/[zone]/page.tsx` - Refactor Breach POIs
- `src/app/grid/page.tsx` - Refactor Overnet Scan
- `src/app/gigs/[id]/page.tsx` - Refactor Gigs (if applicable)

### Long-term (Phase 4)
- `src/hooks/useActionState.ts` (new)

## Migration Strategy

1. Start with fixing PoiCard (high visibility, clear bug)
2. Create shared components with backward compatibility
3. Migrate one action type at a time
4. Test thoroughly between migrations
5. Document the pattern for future actions

## Notes

- Consider creating a Storybook for these components
- Add TypeScript interfaces for all action result types
- Consider animation/transition consistency
- Ensure mobile responsiveness is consistent
- Add proper ARIA labels for accessibility
