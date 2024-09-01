import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDraftData } from "@/contexts/DraftDataContext";
import { useRouter } from "next/navigation";

const formSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  draftId: z.string().min(1, "Draft ID is required"),
});

type FormData = z.infer<typeof formSchema>;

export function useDraftAssistantForm(
  initialUserId: string,
  initialDraftId: string
) {
  const [userIdError, setUserIdError] = useState<string | null>(null);
  const [draftIdError, setDraftIdError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { loading, refetchData } = useDraftData();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: initialUserId,
      draftId: initialDraftId,
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setUserIdError(null);
    setDraftIdError(null);
    router.push(
      `/draft-assistant?userId=${data.userId}&draftId=${data.draftId}`
    );
    await refetchData();
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (!loading.draftDetails && !loading.draftPicks && !loading.players) {
      setIsSubmitting(false);
    }
  }, [loading]);

  return {
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
  };
}
