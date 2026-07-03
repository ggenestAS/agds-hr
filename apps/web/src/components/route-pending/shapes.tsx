import {
  CardGridSkeleton,
  FormSkeleton,
  PageHeaderSkeleton,
  RoutePendingShell,
  StackedCardsSkeleton,
  TableSkeleton,
  TwoColumnSkeleton,
  type PendingWidth,
} from "./shared.tsx";

// Per-shape route pendings (§9.1): routes pick the shape matching their real
// layout via `pendingComponent`. With defaultPendingMs 150 / MinMs 200 these
// only appear for loads slower than 150ms, and never flash.

export function TableRoutePending({ width, columns }: { width: PendingWidth; columns: number }) {
  return (
    <RoutePendingShell width={width}>
      <PageHeaderSkeleton />
      <TableSkeleton columns={columns} />
    </RoutePendingShell>
  );
}

export function TwoColumnRoutePending({ width }: { width: PendingWidth }) {
  return (
    <RoutePendingShell width={width}>
      <PageHeaderSkeleton intro />
      <TwoColumnSkeleton />
    </RoutePendingShell>
  );
}

export function StackedRoutePending({ width }: { width: PendingWidth }) {
  return (
    <RoutePendingShell width={width}>
      <PageHeaderSkeleton intro />
      <StackedCardsSkeleton />
    </RoutePendingShell>
  );
}

export function CardGridRoutePending({ width }: { width: PendingWidth }) {
  return (
    <RoutePendingShell width={width}>
      <PageHeaderSkeleton intro />
      <CardGridSkeleton />
    </RoutePendingShell>
  );
}

export function FormRoutePending({ width }: { width: PendingWidth }) {
  return (
    <RoutePendingShell width={width}>
      <PageHeaderSkeleton />
      <FormSkeleton />
    </RoutePendingShell>
  );
}

// Router-level fallback for routes without a declared shape.
export function RoutePending() {
  return (
    <RoutePendingShell width="4xl">
      <PageHeaderSkeleton intro />
      <StackedCardsSkeleton count={2} />
    </RoutePendingShell>
  );
}
