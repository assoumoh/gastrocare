/**
 * Skeletons.tsx
 * Composants de chargement réutilisables.
 * Remplacent les pages vides pendant le chargement Firestore.
 */

import React from 'react';

/** Barre de skeleton animée */
function SkeletonBar({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-slate-200 rounded animate-pulse ${className}`} />
  );
}

/** Skeleton pour une ligne de tableau / liste */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-slate-100">
      <SkeletonBar className="w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBar className="h-4 w-1/3" />
        <SkeletonBar className="h-3 w-1/2" />
      </div>
      <SkeletonBar className="h-6 w-20 rounded-full" />
    </div>
  );
}

/** Skeleton pour une page liste (table/liste de données) */
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header fictif */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <SkeletonBar className="h-5 w-40" />
        <SkeletonBar className="h-8 w-28 rounded-lg" />
      </div>
      {/* Barre de recherche fictive */}
      <div className="p-4 border-b border-slate-100">
        <SkeletonBar className="h-9 w-full rounded-lg" />
      </div>
      {/* Lignes */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** Skeleton pour une carte KPI (dashboard) */
export function SkeletonKPI() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
      <SkeletonBar className="h-3 w-24" />
      <SkeletonBar className="h-8 w-16" />
    </div>
  );
}

/** Skeleton pour le dashboard complet */
export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <SkeletonBar className="h-7 w-64" />
        <SkeletonBar className="h-5 w-48" />
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonKPI key={i} />)}
      </div>
      {/* Blocs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 h-64">
            <SkeletonBar className="h-5 w-40" />
            {Array.from({ length: 4 }).map((_, j) => <SkeletonRow key={j} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton pour un formulaire */
export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1">
          <SkeletonBar className="h-3 w-24" />
          <SkeletonBar className="h-9 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
