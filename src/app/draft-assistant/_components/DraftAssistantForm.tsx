import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import DraftInfo from "./DraftInfo";

const formSchema = z.object({
  username: z.string().min(1, "Username is required"),
  draftId: z.string().optional(),
  draftUrl: z.string().optional(),
});

type DraftAssistantFormData = z.infer<typeof formSchema>;

interface DraftAssistantFormProps {
  step?: "user" | "draft" | "full";
}

export default function DraftAssistantForm({
  step = "full",
}: DraftAssistantFormProps) {
  const {
    username,
    setUsername,
    loadUserAndDrafts,
    selectedDraftId,
    setSelectedDraftId,
    drafts,
    error,
    loading,
  } = useDraftData();

  const form = useForm<DraftAssistantFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      draftId: "",
      draftUrl: "",
    },
  });

  // Keep form synced with context username (for URL prefill and clearing)
  React.useEffect(() => {
    if (form.getValues("username") !== username) {
      form.setValue("username", username, { shouldDirty: false });
    }
  }, [username, form]);

  const [radioSelection, setRadioSelection] = React.useState<string>(
    selectedDraftId || ""
  );
  const triedSubmitRef = React.useRef(false);

  React.useEffect(() => {
    if (selectedDraftId && selectedDraftId !== radioSelection) {
      setRadioSelection(selectedDraftId);
    }
  }, [selectedDraftId, radioSelection]);

  const draftUrlCurrent = (form.watch("draftUrl") || "").trim();

  React.useEffect(() => {
    if (
      (step === "draft" || step === "full") &&
      drafts?.length &&
      !radioSelection
    ) {
      const firstDraft = drafts[0];
      if (!firstDraft) return;
      const defaultId = firstDraft.draft_id;
      setRadioSelection(defaultId);
      // IMPORTANT: don't commit to context/URL here.
      // Only commit when user presses Submit.
    }
  }, [drafts, step, radioSelection]);

  const onSubmit = async (data: DraftAssistantFormData) => {
    triedSubmitRef.current = true;
    try {
      const normalizedUsername = (data.username || "").trim();
      const shouldRunUser =
        step === "user" ||
        (step === "full" &&
          normalizedUsername &&
          normalizedUsername !== username);
      if (shouldRunUser) {
        setUsername(normalizedUsername);
        await loadUserAndDrafts();
      }

      // Handle draft choice (draft step or full step)
      if (step !== "user") {
        if (radioSelection === "manual" && data.draftUrl?.trim()) {
          const draftUrlMatch =
            data.draftUrl.match(/\/draft\/[A-Za-z]+\/([A-Za-z0-9]+)/) ||
            data.draftUrl.match(/^([A-Za-z0-9]+)$/);
          if (draftUrlMatch?.[1]) {
            setSelectedDraftId(draftUrlMatch[1]);
          }
        } else if (data.draftId?.trim()) {
          setSelectedDraftId(data.draftId.trim());
        } else if (radioSelection && radioSelection !== "manual") {
          setSelectedDraftId(radioSelection);
        }
      }
    } catch (err) {
      console.error("Form submission error:", err);
    }
  };
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mb-4"
        autoComplete="off"
        data-lpignore="true"
        data-form-type="other"
      >
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>
              {step === "user"
                ? "User Input"
                : step === "draft"
                ? "Draft Selection"
                : "League Details"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(step === "user" || step === "full") && (
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="sleeper-username">
                      Sleeper Username
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="sleeper-username"
                        placeholder="enter username"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        inputMode="text"
                        data-lpignore="true"
                        {...field}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          field.onChange(e);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {(step === "draft" || step === "full") && (
              <div className="space-y-2">
                <Label>Select Draft</Label>
                <RadioGroup
                  value={radioSelection}
                  onValueChange={(v) => {
                    setRadioSelection(v);
                    if (v === "manual") {
                      form.setValue("draftId", "", {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }
                  }}
                  className="grid gap-3"
                  aria-disabled={loading.user || loading.drafts}
                >
                  {drafts.map((d) => {
                    const title = d.metadata?.name || d.name || d.draft_id;
                    const value = d.draft_id;
                    const checked = selectedDraftId === value;
                    return (
                      <Card
                        key={value}
                        className={checked ? "ring-2 ring-primary" : ""}
                      >
                        <CardContent className="py-4">
                          <div className="flex items-start gap-3">
                            <RadioGroupItem
                              value={value}
                              aria-label={`Select draft ${title}`}
                              disabled={loading.user || loading.drafts}
                            />
                            <div className="flex flex-col grow">
                              <DraftInfo
                                name={title}
                                draftId={d.draft_id}
                                {...(d.type && { type: d.type })}
                                {...(d.settings?.teams && {
                                  teams: d.settings.teams,
                                })}
                                {...(d.settings?.rounds && {
                                  rounds: d.settings.rounds,
                                })}
                                {...(d.season && { season: d.season })}
                                {...(d.start_time && {
                                  startTime: d.start_time,
                                })}
                                {...(d.status && { status: d.status })}
                                {...(d.metadata?.scoring_type && {
                                  scoringType: d.metadata.scoring_type,
                                })}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  <Card>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <RadioGroupItem
                          value="manual"
                          aria-label="Select manual draft"
                          disabled={loading.user || loading.drafts}
                          onClick={() => {
                            if (radioSelection !== "manual") {
                              setRadioSelection("manual");
                              form.setValue("draftId", "", {
                                shouldValidate: true,
                                shouldDirty: true,
                              });
                            }
                          }}
                        />
                        <div className="flex w-full flex-col gap-2">
                          <Label htmlFor="draftUrl">
                            Or paste a Sleeper draft URL
                          </Label>
                          <FormField
                            control={form.control}
                            name="draftUrl"
                            render={({ field }) => (
                              <FormControl>
                                <Input
                                  type="url"
                                  id="draftUrl"
                                  placeholder="https://sleeper.com/draft/nfl/XXXXXXXXXXXX"
                                  {...field}
                                  onFocus={(e) => {
                                    if (radioSelection !== "manual") {
                                      setRadioSelection("manual");
                                      form.setValue("draftId", "", {
                                        shouldValidate: true,
                                        shouldDirty: true,
                                      });
                                    }
                                  }}
                                />
                              </FormControl>
                            )}
                          />
                          {radioSelection === "manual" &&
                            !draftUrlCurrent &&
                            (form.getFieldState("draftUrl").isTouched ||
                              triedSubmitRef.current) && (
                              <p className="text-sm text-red-500">
                                Enter a draft URL to continue.
                              </p>
                            )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </RadioGroup>
                <FormField
                  control={form.control}
                  name="draftId"
                  render={({ field }) => (
                    <input id="draftIdHidden" type="hidden" {...field} />
                  )}
                />
                {form.formState.errors.draftId?.message && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.draftId.message}
                  </p>
                )}
              </div>
            )}

            {step === "user" && (
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={
                    loading.user || loading.drafts || !(username || "").trim()
                  }
                >
                  {loading.user || loading.drafts ? "Working..." : "Submit"}
                </Button>
              </div>
            )}

            {(step === "draft" || step === "full") && (
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={
                    loading.user ||
                    loading.drafts ||
                    (radioSelection === "manual"
                      ? !draftUrlCurrent
                      : !radioSelection)
                  }
                >
                  {loading.user || loading.drafts
                    ? "Working..."
                    : "Select Draft"}
                </Button>
              </div>
            )}

            {(error.user || error.drafts || error.draftDetails) && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {error.user?.message ||
                    error.drafts?.message ||
                    error.draftDetails?.message ||
                    "An error occurred while loading data"}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
