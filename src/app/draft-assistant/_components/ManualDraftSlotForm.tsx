"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const ManualDraftSlotSchema = z.object({
  draftSlot: z.number().int().min(1, "Select a draft slot."),
});

type ManualDraftSlotValues = z.infer<typeof ManualDraftSlotSchema>;

export default function ManualDraftSlotForm({
  currentSlot,
  teams,
  onSave,
}: {
  currentSlot: number | null;
  teams: number;
  onSave: (draftSlot: number) => void;
}) {
  const form = useForm<ManualDraftSlotValues>({
    resolver: zodResolver(ManualDraftSlotSchema),
    defaultValues: { draftSlot: currentSlot ?? 0 },
  });

  const submit = (values: ManualDraftSlotValues) => {
    if (values.draftSlot > teams) {
      form.setError("draftSlot", {
        message: `Select a slot from 1 to ${teams}.`,
      });
      return;
    }
    onSave(values.draftSlot);
  };

  return (
    <Form {...form}>
      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={form.handleSubmit(submit)}
        data-testid="manual-draft-slot-form"
      >
        <FormField
          control={form.control}
          name="draftSlot"
          render={({ field }) => (
            <FormItem className="max-w-40">
              <FormLabel>Your draft slot</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={teams}
                  inputMode="numeric"
                  value={field.value || ""}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  onChange={(event) =>
                    field.onChange(event.currentTarget.valueAsNumber || 0)
                  }
                  aria-label="Your draft slot"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">{currentSlot ? "Update" : "Use slot"}</Button>
      </form>
    </Form>
  );
}
