@tailwind base;
@tailwind components;
@tailwind utilities;

body { @apply bg-paper text-ink font-body; }

/* „Cota tehnică" — elementul de semnătură al secțiunilor (din design-ul aprobat în PDF) */
.dim { @apply flex items-center gap-2.5 font-disp font-semibold text-[12px] tracking-[0.25em] uppercase text-mut; }
.dim::before, .dim::after { content: ""; @apply block w-6 h-px bg-mut; border-left: 1px solid #6C7480; }

.fld label { @apply block text-[12px] font-semibold text-steel mb-1; }
.fld input, .fld select, .fld textarea {
  @apply w-full rounded-lg border-2 border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-acc;
}
.btn-acc { @apply inline-flex items-center justify-center gap-2 rounded-lg bg-acc text-white px-6 py-3 font-disp font-bold uppercase tracking-wide hover:brightness-110 transition; }
.btn-dark { @apply inline-flex items-center justify-center gap-2 rounded-lg bg-ink text-white px-6 py-3 font-disp font-bold uppercase tracking-wide hover:bg-steel transition; }
.card { @apply bg-white border border-line rounded-xl shadow-card; }
