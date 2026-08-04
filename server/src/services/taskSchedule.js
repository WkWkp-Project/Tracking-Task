// Keep task-level dates and explicit phase deadlines on one coherent schedule.
// The task range is authoritative; shrinking/moving it clamps only deadlines
// that would otherwise fall outside the new range.
export function reconcileDraftDueDates(drafts, startDate, endDate) {
  return (drafts || [])
    .filter((draft) => draft.dueDate && (draft.dueDate < startDate || draft.dueDate > endDate))
    .map((draft) => ({
      draftId: draft.id,
      step: draft.step,
      from: draft.dueDate,
      to: draft.dueDate < startDate ? startDate : endDate,
    }));
}
