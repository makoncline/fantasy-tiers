import React from "react";
import type {
  UseFormRegister,
  FieldErrors,
  UseFormSetValue,
  UseFormReturn,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SleeperDraftSummary } from "@/lib/sleeper";
import type { DraftAssistantFormData } from "@/app/draft-assistant/_hooks/useDraftAssistantForm";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import DraftInfo from "./DraftInfo";

interface DraftAssistantFormProps {
  form: UseFormReturn<DraftAssistantFormData>;
  register: UseFormRegister<DraftAssistantFormData>;
  setValue: UseFormSetValue<DraftAssistantFormData>;
  onSubmit: (data: DraftAssistantFormData) => void;
  errors: FieldErrors<DraftAssistantFormData>;
  isSubmitting: boolean;
  userIdError: string | null;
  draftIdError: string | null;
  drafts?: SleeperDraftSummary[];
  selectedDraftId?: string;
  step?: "user" | "draft" | "full";
}

export default function DraftAssistantForm({
  form,
  register,
  setValue,
  onSubmit,
  errors,
  isSubmitting,
  userIdError,
  draftIdError,
  drafts = [],
  selectedDraftId,
  step = "full",
}: DraftAssistantFormProps) {
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
      setValue("draftId", defaultId, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [drafts, step, radioSelection, setValue]);
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => {
          triedSubmitRef.current = true;
          return onSubmit(data);
        })}
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
                      setValue("draftId", "", {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    } else {
                      setValue("draftId", v, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }
                  }}
                  className="grid gap-3"
                  aria-disabled={isSubmitting}
                >
                  {drafts.map((d) => {
                    const title = d.metadata?.name || d.name || d.draft_id;
                    // intentionally unused display locals removed
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
                              disabled={isSubmitting}
                            />
                            <div className="flex flex-col grow">
                              <DraftInfo
                                name={title}
                                draftId={d.draft_id}
                                {...(d.type && { type: d.type })}
                                {...(d.settings?.teams && { teams: d.settings.teams })}
                                {...(d.settings?.rounds && { rounds: d.settings.rounds })}
                                {...(d.season && { season: d.season })}
                                {...(d.start_time && { startTime: d.start_time })}
                                {...(d.status && { status: d.status })}
                                {...(d.metadata?.scoring_type && { scoringType: d.metadata.scoring_type })}
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
                          disabled={isSubmitting}
                          onClick={() => {
                            if (radioSelection !== "manual") {
                              setRadioSelection("manual");
                              setValue("draftId", "", {
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
                          {(() => {
                            const draftUrlReg = register("draftUrl");
                            return (
                              <Input
                                type="url"
                                id="draftUrl"
                                placeholder="https://sleeper.com/draft/nfl/XXXXXXXXXXXX"
                                {...draftUrlReg}
                                onFocus={(e) => {
                                  if (radioSelection !== "manual") {
                                    setRadioSelection("manual");
                                    setValue("draftId", "", {
                                      shouldValidate: true,
                                      shouldDirty: true,
                                    });
                                  }
                                }}
                                onChange={(e) => {
                                  draftUrlReg.onChange(e);
                                }}
                              />
                            );
                          })()}
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
                <input
                  id="draftIdHidden"
                  type="hidden"
                  {...register("draftId")}
                />
                {errors.draftId?.message && (
                  <p className="text-sm text-red-500">
                    {errors.draftId.message}
                  </p>
                )}
              </div>
            )}

            {step === "user" && (
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={
                    isSubmitting || !(form.watch("username") || "").trim()
                  }
                >
                  {isSubmitting ? "Working..." : "Submit"}
                </Button>
              </div>
            )}

            {(step === "draft" || step === "full") && (
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (radioSelection === "manual"
                      ? !draftUrlCurrent
                      : !radioSelection)
                  }
                >
                  {isSubmitting ? "Working..." : "Select Draft"}
                </Button>
              </div>
            )}

            {userIdError && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{userIdError}</AlertDescription>
              </Alert>
            )}

            {draftIdError && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{draftIdError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
