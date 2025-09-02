import { useState, useEffect } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import {
  fetchSleeperUserByUsername,
  fetchSleeperUserById,
  fetchDraftsForUserYear,
  type SleeperDraftSummary,
} from "@/lib/sleeper";

const formSchema = z.object({
  username: z.string().min(1, "Username is required"),
  draftId: z.string().optional(),
  draftUrl: z.string().optional(),
});

export type DraftAssistantFormData = z.infer<typeof formSchema>;

export function useDraftAssistantForm(
  initialUserId: string,
  initialDraftId: string
) {
  const [userIdError, setUserIdError] = useState<string | null>(null);
  const [draftIdError, setDraftIdError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(
    initialUserId || null
  );
  const [drafts, setDrafts] = useState<SleeperDraftSummary[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const router = useRouter();
  const currentYear = String(new Date().getFullYear());

  const form: UseFormReturn<DraftAssistantFormData> =
    useForm<DraftAssistantFormData>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        username: "",
        draftId: initialDraftId || "",
      },
    });
  const {
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors },
    control,
  } = form;

  const loadDrafts = async (): Promise<void> => {
    setUserIdError(null);
    setDraftIdError(null);
    setLoadingDrafts(true);
    try {
      const username = getValues("username") || watch("username");
      if (!username) {
        setUserIdError("Username is required");
        return;
      }
      const user = await fetchSleeperUserByUsername(username);
      setResolvedUserId(user.user_id);
      const ds = await fetchDraftsForUserYear(user.user_id, currentYear);
      setDrafts(ds || []);
      if (ds && ds.length === 1 && ds[0]) {
        setValue("draftId", ds[0].draft_id, { shouldValidate: true });
      }
      const qs = new URLSearchParams();
      qs.set("userId", user.user_id);
      const currentDraftId = getValues("draftId") || "";
      if (currentDraftId) qs.set("draftId", currentDraftId);
      router.push(`/draft-assistant?${qs.toString()}`);
      return;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load user/drafts";
      setUserIdError(msg);
      return;
    } finally {
      setLoadingDrafts(false);
    }
  };

  const onSubmit = async (data: DraftAssistantFormData) => {
    setIsSubmitting(true);
    setUserIdError(null);
    setDraftIdError(null);
    try {
      const username = getValues("username") || watch("username");
      let uid = resolvedUserId;
      if (username) {
        const user = await fetchSleeperUserByUsername(username);
        uid = user.user_id;
        setResolvedUserId(uid);
      }
      if (!uid) {
        setUserIdError("Unable to resolve user. Check username and try again.");
        return;
      }

      const draftUrl = (getValues("draftUrl") || "").trim();
      if (!data.draftId && draftUrl) {
        // match either a full Sleeper URL or a bare alphanumeric ID
        const m =
          draftUrl.match(/\/draft\/[A-Za-z]+\/([A-Za-z0-9]+)/) ||
          draftUrl.match(/^([A-Za-z0-9]+)$/);
        const extracted = m?.[1];
        if (extracted) {
          setValue("draftId", extracted, { shouldValidate: true });
          data.draftId = extracted;
        }
      }

      if (!data.draftId) {
        router.push(`/draft-assistant?userId=${uid}`);
        try {
          const ds = await fetchDraftsForUserYear(uid, currentYear);
          setDrafts(ds || []);
        } catch {}
        return;
      }

      router.push(`/draft-assistant?userId=${uid}&draftId=${data.draftId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // isSubmitting is controlled only by this hook's operations

  useEffect(() => {
    (async () => {
      try {
        if (initialUserId) {
          const user = await fetchSleeperUserById(initialUserId);
          if (user?.username) setValue("username", user.username);
          const ds = await fetchDraftsForUserYear(initialUserId, currentYear);
          setDrafts(ds || []);
          if (initialDraftId) {
            setValue("draftId", initialDraftId, { shouldValidate: true });
            const found = (ds || []).some((d) => d.draft_id === initialDraftId);
            if (!found)
              setValue(
                "draftUrl",
                `https://sleeper.com/draft/nfl/${initialDraftId}`
              );
          }
          setResolvedUserId(initialUserId);
        }
      } catch {}
    })();
  }, [initialUserId, initialDraftId, currentYear, setValue]);

  const selectDraft = (draftId: string) => {
    setValue("draftId", draftId, { shouldValidate: true });
    const qs = new URLSearchParams();
    if (resolvedUserId) qs.set("userId", resolvedUserId);
    qs.set("draftId", draftId);
    router.push(`/draft-assistant?${qs.toString()}`);
  };

  return {
    form,
    register,
    handleSubmit,
    watch,
    setValue,
    errors,
    onSubmit,
    isSubmitting,
    userIdError,
    draftIdError,
    setUserIdError,
    setDraftIdError,
    drafts,
    loadingDrafts,
    loadDrafts,
    selectedDraftId: watch("draftId"),
    selectDraft,
  };
}
