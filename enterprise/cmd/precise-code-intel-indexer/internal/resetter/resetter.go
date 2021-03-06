package resetter

import (
	"context"
	"time"

	"github.com/inconshreveable/log15"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/store"
)

type IndexResetter struct {
	Store         store.Store
	ResetInterval time.Duration
	Metrics       ResetterMetrics
}

// Run periodically moves all indexes that have been in the PROCESSING state for a
// while back to QUEUED. For each updated index record, the indexer process that
// was responsible for handling the index did not hold a row lock, indicating that
// it has died.
func (ur *IndexResetter) Run() {
	for {
		resetIDs, erroredIDs, err := ur.Store.ResetStalledIndexes(context.Background(), time.Now())
		if err != nil {
			ur.Metrics.Errors.Inc()
			log15.Error("Failed to reset stalled indexes", "error", err)
		}
		for _, id := range resetIDs {
			log15.Debug("Reset stalled index", "indexID", id)
		}
		for _, id := range erroredIDs {
			log15.Debug("Failed stalled index", "indexID", id)
		}

		ur.Metrics.IndexResets.Add(float64(len(resetIDs)))
		ur.Metrics.IndexResetFailures.Add(float64(len(erroredIDs)))
		time.Sleep(ur.ResetInterval)
	}
}
