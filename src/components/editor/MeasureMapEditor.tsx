import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, X, Wand2 } from "lucide-react";
import Draggable from "react-draggable";
import type { DAWPayload } from "@/lib/daw/types";
import { useDialogs } from "@/components/ui/dialog-provider";
import { toast } from "sonner";

interface MeasureMapEditorProps {
  payload: DAWPayload;
  positionMs: number;
  onPayloadChange: (payload: DAWPayload) => void;
  onClose: () => void;
}

import { getPhysicalMeasure } from "@/lib/score/math";

export function MeasureMapEditor({ payload, positionMs, onPayloadChange, onClose }: MeasureMapEditorProps) {
  const { confirm, prompt } = useDialogs();
  const currentMap = payload.notationData?.measureMap || {};
  
  // Convert object { "60": 50 } to array [{ latent: 60, physical: 50 }] for rendering
  const entriesList = Object.entries(currentMap)
    .map(([lat, phys]) => ({ latent: Number(lat), physical: phys }))
    .sort((a, b) => a.latent - b.latent);

  const timemap = payload.notationData?.timemap || [];
  
  // Find currently active latent measure based on audio position
  let activeLatent: number | null = null;
  for (let i = 0; i < timemap.length; i++) {
    if (positionMs >= timemap[i].timeMs) activeLatent = timemap[i].measure;
    else break;
  }

  const [newLatent, setNewLatent] = useState<string>("");
  const [newPhysical, setNewPhysical] = useState<string>("");
  const [sigLatent, setSigLatent] = useState<string>("");
  const [sigValue, setSigValue] = useState<string>("");
  const nodeRef = useRef(null);

  const handleAutoGenerate = async () => {
    if (timemap.length > 0) {
      if (!(await confirm({ title: "Overwrite Timeline", description: "Your existing timeline records will be overwritten. Continue?", confirmText: "Overwrite", cancelText: "Cancel" }))) return;
    }
    
    const countStr = await prompt({ title: "Generate Measures", description: "How many transparent measures should be generated?", defaultValue: "100", confirmText: "Generate", cancelText: "Cancel" });
    if (!countStr) return;
    const count = parseInt(countStr, 10);
    if (isNaN(count) || count <= 0) return;

    const bpm = payload.metadata?.tempo || 120;
    const ts = payload.metadata?.timeSignature || "4/4";
    const [num, den] = ts.split("/");
    const beatsPerMeasure = parseInt(num) || 4;
    const noteValue = parseInt(den) || 4;
    
    const msPerQuarterNote = 60000 / bpm;
    const msPerBeat = msPerQuarterNote * (4 / noteValue);
    const measureMs = msPerBeat * beatsPerMeasure;

    const newTimemap: any[] = [];
    for (let i = 1; i <= count; i++) {
      newTimemap.push({
        measure: i,
        timeMs: (i - 1) * measureMs
      });
    }
    
    newTimemap[0].timeSignature = ts;
    updatePayloadTimemap(newTimemap);
  };

  const sigEntriesList = timemap.filter(t => t.timeSignature).map(t => ({
    latent: t.measure,
    sig: t.timeSignature!
  }));

  const handleMeasureClick = (latent: number, currentPhysical: number, currentSig?: string) => {
    // If it's already an explicit anchor, we can prep to edit it/delete it, 
    // but the quickest UX is just pre-filling the inputs for them.
    setNewLatent(latent.toString());
    setNewPhysical(currentPhysical.toString());
    setSigLatent(latent.toString());
    if (currentSig) setSigValue(currentSig);
  };

  const handleAdd = () => {
    const lat = parseInt(newLatent, 10);
    const phys = parseInt(newPhysical, 10);
    
    if (isNaN(lat) || isNaN(phys) || lat <= 0 || phys <= 0) {
      toast.error("Please enter valid positive numbers for both measures.");
      return;
    }

    const newMap = { ...currentMap, [lat]: phys };
    updatePayload(newMap);
    setNewLatent("");
    setNewPhysical("");
  };

  const handleRemove = (latent: number) => {
    const newMap = { ...currentMap };
    delete newMap[latent];
    updatePayload(newMap);
  };

  const updatePayload = (newMap: Record<number, number>) => {
    if (!payload.notationData) return;
    
    // If empty map, we can optionally clean up the key, but saving {} is fine too
    const newNotationData = {
      ...payload.notationData,
      measureMap: Object.keys(newMap).length > 0 ? newMap : undefined,
    };

    onPayloadChange({
      ...payload,
      notationData: newNotationData,
    });
  };

  const handleAddSig = () => {
    const lat = parseInt(sigLatent, 10);
    const sig = sigValue.trim();
    if (isNaN(lat) || lat <= 0 || !sig.includes("/")) return;
    
    const newTimemap = [...timemap];
    const idx = newTimemap.findIndex(t => t.measure === lat);
    if (idx > -1) {
       newTimemap[idx] = { ...newTimemap[idx], timeSignature: sig };
       updatePayloadTimemap(newTimemap);
       setSigLatent("");
       setSigValue("");
    } else {
       toast.error("Measure not recorded in timeline yet.");
    }
  };

  const handleRemoveSig = (latent: number) => {
    const newTimemap = [...timemap];
    const idx = newTimemap.findIndex(t => t.measure === latent);
    if (idx > -1) {
       const { timeSignature, ...rest } = newTimemap[idx];
       newTimemap[idx] = rest;
       updatePayloadTimemap(newTimemap);
    }
  };

  const updatePayloadTimemap = (newTimemap: any[]) => {
    if (!payload.notationData) return;
    onPayloadChange({
      ...payload,
      notationData: {
        ...payload.notationData,
        timemap: newTimemap
      }
    });
  };

  return (
    <Draggable nodeRef={nodeRef} handle=".drag-handle" bounds="body">
      <div ref={nodeRef} className="fixed right-4 top-20 w-80 bg-background border border-border rounded-lg shadow-xl flex flex-col z-50 overflow-hidden cursor-default">
        <div className="drag-handle cursor-move flex items-center justify-between px-3 py-2 bg-muted/80 hover:bg-muted border-b border-border transition-colors">
          <h3 className="font-semibold text-sm pointer-events-none">Measure Map</h3>
          <div className="flex items-center gap-1 cursor-default">
            <button onClick={handleAutoGenerate} className="p-1.5 text-blue-500 hover:text-white hover:bg-blue-500 rounded transition-colors" title="Auto-Generate Timemap Grid">
              <Wand2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-white hover:bg-red-500 rounded transition-colors" title="Close Panel">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

      <div className="p-3 text-sm text-muted-foreground">
        <p>Define anchors where the audio latency measure jumps back/forward to a different printed sheet measure.</p>
      </div>

      <div className="flex-1 overflow-auto max-h-64 p-3 pt-0">
        {entriesList.length > 0 && (
          <div className="mb-4 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Anchors</h4>
            {entriesList.map(entry => (
              <div key={`anchor-${entry.latent}`} className="flex items-center gap-2 bg-muted/30 p-1.5 rounded border border-border">
                <div className="flex-1 text-center font-mono bg-background border border-border rounded py-1">{entry.latent}</div>
                <div className="text-muted-foreground">→</div>
                <div className="flex-1 text-center font-mono bg-background border border-border rounded py-1">{entry.physical}</div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleRemove(entry.latent)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {sigEntriesList.length > 0 && (
          <div className="mb-4 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meter Changes</h4>
            {sigEntriesList.map(entry => (
              <div key={`meter-${entry.latent}`} className="flex items-center gap-2 bg-purple-500/10 p-1.5 rounded border border-purple-500/20">
                <div className="flex-1 text-center font-mono bg-background border border-border rounded py-1 text-purple-600">{entry.latent}</div>
                <div className="text-muted-foreground">→</div>
                <div className="flex-1 text-center font-mono font-bold bg-background border border-border rounded py-1 text-purple-600">{entry.sig}</div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleRemoveSig(entry.latent)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {timemap.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recorded Timeline</h4>
            <div className="grid grid-cols-5 gap-1.5">
              {timemap.map((t) => {
                const latent = t.measure;
                const physical = getPhysicalMeasure(latent, currentMap);
                const isAnchor = currentMap[latent] !== undefined;
                const hasSig = t.timeSignature !== undefined;
                const hasTempo = t.tempo !== undefined;
                const isActive = latent === activeLatent;

                return (
                  <button
                    key={`timeline-${latent}`}
                    onClick={() => handleMeasureClick(latent, physical, t.timeSignature)}
                    className={`
                      relative flex flex-col items-center justify-center p-1 rounded border text-xs cursor-pointer transition-colors
                      ${isActive ? 'bg-blue-100 border-blue-400 text-blue-900 shadow-sm' : 'bg-background border-border hover:bg-muted/50'}
                      ${isAnchor ? 'ring-1 ring-orange-400 border-orange-400' : ''}
                      ${hasSig && !isAnchor ? 'ring-1 ring-purple-400 border-purple-400' : ''}
                      ${hasTempo && !isAnchor && !hasSig ? 'ring-1 ring-red-400 border-red-400' : ''}
                    `}
                    title={`Audio Measure ${latent} ➔ Sheet Measure ${physical} ${hasSig ? `(${t.timeSignature})` : ''} ${hasTempo ? `[♩=${t.tempo}]` : ''}`}
                  >
                    <span className="font-mono font-bold">{latent}</span>
                    <span className="text-[10px] opacity-60">S:{physical}</span>
                    {isAnchor && <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></div>}
                    {hasSig && <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-purple-500 rounded-full"></div>}
                    {hasTempo && <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full" title={`♩=${t.tempo}`}></div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-muted/30 border-t border-border mt-auto flex flex-col gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Set Anchor Point</label>
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              placeholder="Audio #" 
              className="w-16 bg-background border border-border rounded px-2 py-1.5 text-sm"
              value={newLatent}
              onChange={e => setNewLatent(e.target.value)}
              min="1"
            />
            <div className="text-muted-foreground">→</div>
            <input 
              type="number" 
              placeholder="Sheet #" 
              className="flex-1 w-full bg-background border border-border rounded px-2 py-1.5 text-sm"
              value={newPhysical}
              onChange={e => setNewPhysical(e.target.value)}
              min="1"
            />
            <Button size="icon" onClick={handleAdd} disabled={!newLatent || !newPhysical}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="pt-3 border-t border-border">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block text-purple-600">Set Time Signature</label>
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              placeholder="Audio #" 
              className="w-16 bg-background border border-purple-500/30 rounded px-2 py-1.5 text-sm"
              value={sigLatent}
              onChange={e => setSigLatent(e.target.value)}
              min="1"
            />
            <div className="text-muted-foreground">→</div>
            <input 
              type="text" 
              placeholder="e.g. 6/8" 
              className="flex-1 w-full bg-background border border-purple-500/30 rounded px-2 py-1.5 text-sm"
              value={sigValue}
              onChange={e => setSigValue(e.target.value)}
            />
            <Button size="icon" variant="outline" className="border-purple-500/50 text-purple-600 hover:bg-purple-50" onClick={handleAddSig} disabled={!sigLatent || !sigValue}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      </div>
    </Draggable>
  );
}
