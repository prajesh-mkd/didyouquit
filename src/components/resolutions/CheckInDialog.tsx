
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle } from "lucide-react";

interface CheckInDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    onSave: (status: boolean, note: string) => void;
    initialStatus?: boolean | null;
    initialNote?: string;
}

export function CheckInDialog({ open, onOpenChange, title, onSave, initialStatus = null, initialNote = "" }: CheckInDialogProps) {
    const [selectedStatus, setSelectedStatus] = useState<boolean | null>(initialStatus);
    const [note, setNote] = useState(initialNote);
    const [showError, setShowError] = useState(false);

    // Reset state when dialog opens/closes or initial props change
    useEffect(() => {
        if (open) {
            setSelectedStatus(initialStatus);
            setNote(initialNote || "");
            setShowError(false);
        } else {
            // Optional: reset on close
            setSelectedStatus(null);
            setNote("");
            setShowError(false);
        }
    }, [open, initialStatus, initialNote]);

    const handleSaveClick = () => {
        if (!note.trim()) {
            setShowError(true);
            return;
        }

        if (selectedStatus !== null) {
            onSave(selectedStatus, note);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Weekly Check-in</DialogTitle>
                    <DialogDescription>
                        {title || "Did you keep your resolution for this week?"}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-3">
                            <Button
                                size="lg"
                                onClick={() => setSelectedStatus(true)}
                                variant={selectedStatus === true ? "default" : "outline"}
                                className={`flex-1 gap-2 h-12 text-base transition-all ${selectedStatus === true
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-600 ring-offset-2"
                                    : "hover:bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }`}
                            >
                                <CheckCircle2 className="h-5 w-5" /> Kept It
                            </Button>
                            <Button
                                size="lg"
                                onClick={() => setSelectedStatus(false)}
                                variant={selectedStatus === false ? "default" : "outline"}
                                className={`flex-1 gap-2 h-12 text-base transition-all ${selectedStatus === false
                                    ? "bg-red-600 hover:bg-red-700 text-white ring-2 ring-red-600 ring-offset-2 border-transparent"
                                    : "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    }`}
                            >
                                <XCircle className="h-5 w-5" /> Missed It
                            </Button>
                        </div>

                        <div className="space-y-2 pt-2 border-t mt-2">
                            <label className="text-sm font-medium text-slate-700">
                                Weekly Journal <span className="text-xs font-normal text-black ml-1">(Required)</span>
                            </label>
                            <Textarea
                                value={note}
                                onChange={(e) => {
                                    setNote(e.target.value);
                                    if (e.target.value.trim()) setShowError(false);
                                }}
                                placeholder="How did it go last week? Share your wins or struggles with the community..."
                                className={`min-h-[100px] ${showError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                            />
                        </div>

                        <Button
                            onClick={handleSaveClick}
                            disabled={selectedStatus === null}
                            className="w-full mt-2 bg-slate-900 text-white hover:bg-slate-800"
                            size="lg"
                        >
                            Complete Check-in
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
