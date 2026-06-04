import { useEffect, useState, type ReactNode } from "react";
import { FiX } from "react-icons/fi";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

type TabId = "start" | "types" | "encryption" | "concepts";

const TABS: { id: TabId; label: string }[] = [
  { id: "start", label: "Getting Started" },
  { id: "types", label: "Partition Types" },
  { id: "encryption", label: "Flags & Encryption" },
  { id: "concepts", label: "Key Concepts" },
];

const STEPS: { title: string; body: string }[] = [
  {
    title: "1. Load your ESP-IDF project",
    body: "Click Load Project and pick the project folder — the one containing CMakeLists.txt and an sdkconfig.defaults file. The tool reads your existing partition CSV (or generates a sensible default) and pre-fills the partition table offset and flash size from sdkconfig.",
  },
  {
    title: "2. Set the flash size",
    body: "Choose the flash size of your ESP chip from the Flash Size dropdown. Every limit, the visual map, and the free-space figures update to match.",
  },
  {
    title: "3. Edit the partition table",
    body: "Use Add Partition to append a row, then set its name, type, and subtype. Resize with the number field, the unit selector, the drag slider, or the fill button that expands a partition into all the space available to it. Remove a row with the trash icon.",
  },
  {
    title: "4. Read the visual map",
    body: "Reserved is the space the bootloader and partition table occupy before your first partition. Coloured segments are your partitions; Free is unallocated flash. App-type partitions must start on a 64 KB boundary, so small alignment gaps are normal.",
  },
  {
    title: "5. Watch the validation panel",
    body: "The Validation card flags overlaps, misaligned or out-of-range offsets (including the Partition Start value), partitions past the flash boundary, duplicate names, illegal flag combinations, and other ESP-IDF partition rules. Clear every error before flashing the device.",
  },
  {
    title: "6. Save or copy the result",
    body: "Save / Export writes the partition CSV back to your project and keeps the sdkconfig partition entries in sync. You can also copy the CSV from Partition Preview, or the sdkconfig lines from Entry for sdkconfig, and paste them in manually.",
  },
];

interface Reference {
  name: string;
  purpose: string;
  when: string;
}

const APP_SUBTYPES: Reference[] = [
  {
    name: "factory",
    purpose: "The main application image. The bootloader runs it when there is no valid OTA selection.",
    when: "Use it for standard firmware. Almost every project has exactly one.",
  },
  {
    name: "ota_0 … ota_15",
    purpose: "Application slots used for over-the-air (OTA) updates. The device boots whichever slot the OTA data points to.",
    when: "Add ota_0 and ota_1 (plus an 'ota' data partition) when you need remote firmware updates.",
  },
  {
    name: "test",
    purpose: "An optional separate image used for factory/production testing.",
    when: "Rarely needed — only for a dedicated production-test firmware.",
  },
];

const DATA_SUBTYPES: Reference[] = [
  {
    name: "nvs",
    purpose: "Non-Volatile Storage — a small key/value database. WiFi and Bluetooth keep calibration and settings here, and your app can store its own configuration.",
    when: "Include one in almost every project. 12 KB (0x3000) is the recommended minimum; 16–24 KB is common.",
  },
  {
    name: "phy",
    purpose: "Holds RF (PHY) calibration data for the radio.",
    when: "Only needed when 'PHY init data in partition' is enabled in menuconfig. Typically 4 KB.",
  },
  {
    name: "ota",
    purpose: "Records which OTA app slot the bootloader should start next.",
    when: "Required whenever you use ota_* app partitions. Its size is fixed at 8 KB (0x2000).",
  },
  {
    name: "coredump",
    purpose: "Storage for a crash dump captured when the firmware panics, for later analysis.",
    when: "Add roughly 64 KB when you want to debug crashes after they happen.",
  },
  {
    name: "spiffs / littlefs / fat",
    purpose: "A filesystem partition for storing files — web assets, logs, configuration, user data.",
    when: "Add one when your app reads or writes files. LittleFS is the modern choice; FAT for SD-card compatibility.",
  },
  {
    name: "nvs_keys",
    purpose: "Stores the encryption keys that protect an encrypted NVS partition.",
    when: "Add it only when you turn on NVS encryption.",
  },
];

const CONCEPTS: { title: string; body: string }[] = [
  {
    title: "The partition table & reserved space",
    body: "Flash begins with the second-stage bootloader and the partition table itself. The toolbox shows this as the grey 'Reserved' block; your partitions start right after it. The partition-table offset (Partition Start) is editable in the Project Header — it pre-fills from CONFIG_PARTITION_TABLE_OFFSET when you load a project. 0x8000 is the ESP-IDF and Arduino-ESP32 default; bumping it (0x9000, 0xA000, …) gives the bootloader more room, and 0x10000 is a common preset when secure boot or flash encryption is enabled.",
  },
  {
    title: "Offset & alignment",
    body: "Offset is the flash address where a partition starts. app partitions must begin on a 64 KB (0x10000) boundary; data partitions on a 4 KB (0x1000) boundary. The toolbox auto-packs offsets for you, which can leave small unavoidable gaps.",
  },
  {
    title: "Advanced mode",
    body: "The Advanced toggle above the partition table unlocks editable offsets — pin a partition to a fixed flash address while the rest keep auto-packing — and custom numeric partition types. Leave it off for everyday work.",
  },
  {
    title: "Sizes & units",
    body: "Enter a size in KB or MB, or as a hex byte count. Keep sizes a multiple of 4 KB. The slider, the unit selector, and the fill button all edit the same underlying value.",
  },
  {
    title: "Flash size",
    body: "Set Flash Size to match your module's flash chip — when you load a project, the tool detects it from CONFIG_ESPTOOLPY_FLASHSIZE automatically. Allocating more than the chip actually has is the most common mistake — the validation panel will catch it.",
  },
  {
    title: "Validation before flashing",
    body: "A green validation panel means the layout is safe to build. Errors flag overlaps, bad alignment (including the Partition Start value), partitions past the end of flash, duplicate names, illegal flag combinations, and other ESP-IDF partition rules. Fix them all first.",
  },
];

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.8em] text-slate-800 dark:bg-slate-800 dark:text-slate-200">
      {children}
    </code>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-sky-700 dark:text-sky-300">{children}</h3>;
}

function ReferenceList({ items }: { items: Reference[] }) {
  return (
    <dl className="space-y-3">
      {items.map((item) => (
        <div key={item.name} className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[9rem_1fr]">
          <dt className="font-mono text-xs font-semibold text-sky-700 dark:text-sky-300">
            {item.name}
          </dt>
          <dd className="text-sm text-slate-700 dark:text-slate-300">
            {item.purpose}
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              When to use: {item.when}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function GettingStartedTab() {
  return (
    <>
      <ol className="space-y-4">
        {STEPS.map((step) => (
          <li key={step.title}>
            <SubHeading>{step.title}</SubHeading>
            <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {step.body}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
        <span className="font-semibold text-slate-700 dark:text-slate-200">Tip:</span>{" "}
        Right-click any text field for cut, copy, paste, and select-all. The partition CSV
        and sdkconfig entries always reflect your latest edits.
      </div>
    </>
  );
}

function PartitionTypesTab() {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        Every partition has a <strong>Type</strong> and a <strong>Subtype</strong>. The type
        is either <Code>app</Code> (runnable firmware) or <Code>data</Code> (everything
        else). The subtype narrows the exact role. Advanced mode also accepts custom
        numeric types (<Code>0x40</Code>–<Code>0xFE</Code>) and subtypes for
        application-defined partitions.
      </p>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          App partitions (type: app)
        </h3>
        <ReferenceList items={APP_SUBTYPES} />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Data partitions (type: data)
        </h3>
        <ReferenceList items={DATA_SUBTYPES} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          A minimal project
        </span>{" "}
        needs just an <Code>nvs</Code> data partition and one <Code>factory</Code> app
        partition. Add an <Code>ota</Code> data partition plus <Code>ota_0</Code>/
        <Code>ota_1</Code> app partitions only when you need over-the-air updates.
      </div>
    </div>
  );
}

function EncryptionTab() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      <p>
        The <strong>Flags</strong> column has two optional toggles —{" "}
        <strong>Encrypted</strong> and <strong>Read-only</strong> — both off by default.
      </p>

      <div>
        <SubHeading>What flash encryption is</SubHeading>
        <p className="mt-1">
          Flash encryption is a hardware security feature of the ESP32. When enabled, the
          contents of the SPI flash are stored encrypted, so firmware and data cannot be
          read off the chip.
        </p>
      </div>

      <div>
        <SubHeading>What is encrypted automatically</SubHeading>
        <p className="mt-1">
          With flash encryption on, the bootloader, the partition table, and every{" "}
          <Code>app</Code> partition are <strong>always</strong> encrypted — the flag is
          not needed for them. <Code>data</Code> partitions are <strong>not</strong>{" "}
          encrypted unless you mark them.
        </p>
      </div>

      <div>
        <SubHeading>What the Encrypted flag does</SubHeading>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            Turn it on for a <Code>data</Code> partition (spiffs, fat, littlefs,
            coredump…) to have that partition's contents encrypted too.
          </li>
          <li>
            It has no effect on <Code>app</Code> partitions — they are already encrypted.
          </li>
          <li>
            It cannot be used on <Code>nvs</Code>. NVS has its own encryption scheme that
            uses a separate <Code>nvs_keys</Code> partition.
          </li>
          <li>If flash encryption is not enabled on the device, the flag does nothing.</li>
        </ul>
      </div>

      <div>
        <SubHeading>When to enable it</SubHeading>
        <p className="mt-1">
          Enable it on data partitions that hold sensitive information — certificates,
          keys, private user files — for products that use flash encryption. Leave it off
          for non-sensitive data, or if you are not using flash encryption.
        </p>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        <span className="font-semibold">Important:</span> This toolbox only sets the
        partition flag. Flash encryption itself is enabled through menuconfig and by
        burning eFuses on the chip — that is largely a one-way, irreversible operation.
        Read the ESP-IDF “Flash Encryption” guide before enabling it on a production
        device.
      </div>

      <div>
        <SubHeading>The Read-only flag</SubHeading>
        <p className="mt-1">
          The <strong>Read-only</strong> toggle marks a <Code>data</Code> partition as
          read-only, so the firmware treats its contents as immutable.
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            It applies to <Code>data</Code> partitions only — never <Code>app</Code>{" "}
            partitions, and not the <Code>ota</Code> or <Code>coredump</Code> subtypes.
            The toggle is disabled wherever the flag is not allowed.
          </li>
          <li>
            Use it for partitions shipped with fixed content — a bundled filesystem of
            web assets, certificates, or factory data the device must never overwrite.
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        <span className="font-semibold">Version note:</span> the read-only flag was added
        in ESP-IDF 5.2. Older ESP-IDF versions reject it and the build fails — only enable
        it when your project targets ESP-IDF 5.2 or newer.
      </div>
    </div>
  );
}

function KeyConceptsTab() {
  return (
    <div className="space-y-4">
      {CONCEPTS.map((concept) => (
        <div key={concept.title}>
          <SubHeading>{concept.title}</SubHeading>
          <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {concept.body}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function HelpModal({ open, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("start");

  // Always reopen on the first tab — friendliest for someone looking for help.
  useEffect(() => {
    if (open) {
      setActiveTab("start");
    }
  }, [open]);

  if (!open) {
    return <></>;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 px-4 py-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How to use ESP Partition Toolbox"
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold">Help & Reference</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Build ESP-IDF partition tables with confidence
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 p-1.5 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>

        <div role="tablist" className="flex gap-1 border-b border-slate-200 px-3 dark:border-slate-800">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-sky-500 text-sky-700 dark:text-sky-300"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="flex-1 overflow-y-auto px-5 py-4">
          {activeTab === "start" && <GettingStartedTab />}
          {activeTab === "types" && <PartitionTypesTab />}
          {activeTab === "encryption" && <EncryptionTab />}
          {activeTab === "concepts" && <KeyConceptsTab />}
        </div>
      </div>
    </div>
  );
}
