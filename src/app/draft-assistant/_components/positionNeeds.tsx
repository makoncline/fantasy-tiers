// src/components/PositionNeeds.tsx

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { POSITIONS, type Position } from "../_lib/types";

interface PositionNeedsProps {
  userPositionNeeds: Partial<Record<Position, number>>;
  userPositionCounts: Partial<Record<Position, number>>;
  draftWideNeeds: Partial<Record<Position, number>>;
}

export default function PositionNeeds({
  userPositionNeeds,
  userPositionCounts,
  draftWideNeeds,
}: PositionNeedsProps) {
  const positions = POSITIONS;
  const categories = [
    { label: "Your Team Needs", data: userPositionNeeds },
    { label: "Your Team Counts", data: userPositionCounts },
    { label: "Draft-Wide Needs", data: draftWideNeeds },
  ];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          {positions.map((position) => (
            <TableHead key={position}>{position}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category) => (
          <TableRow key={category.label}>
            <TableCell>{category.label}</TableCell>
            {positions.map((position) => (
              <TableCell key={position}>
                {category.data[position] ?? 0}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
