"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { type TeamUserItem, normalizeName } from "@/lib/moodboard-watchers";
import { AtSign } from "lucide-react";

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  teamUsers: TeamUserItem[];
  isSubmitting?: boolean;
  disabled?: boolean;
  theme?: "light" | "dark";
  rows?: number;
  className?: string;
}

export default function MentionCommentInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Escreva uma sugestão ou nota... (use @ para mencionar)",
  teamUsers,
  isSubmitting = false,
  disabled = false,
  theme = "light",
  rows = 2,
  className = "",
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter team users based on query after @
  const filteredUsers = React.useMemo(() => {
    if (!isOpen) return [];
    if (!query) return teamUsers;
    const cleanQ = normalizeName(query);
    return teamUsers.filter((u) => normalizeName(u.name).includes(cleanQ));
  }, [isOpen, query, teamUsers]);

  // Check cursor position and detect @ trigger
  const checkMentionTrigger = useCallback(
    (text: string, cursorPos: number) => {
      const textBefore = text.slice(0, cursorPos);
      // Look for @ following start of line or whitespace/punctuation, with no spaces in the query yet
      const match = textBefore.match(/(?:^|\s)@([^\s@]*)$/);

      if (match) {
        const queryText = match[1];
        const atPos = textBefore.lastIndexOf("@");
        setMentionStartIndex(atPos);
        setQuery(queryText);
        setSelectedIndex(0);
        setIsOpen(true);
      } else {
        setIsOpen(false);
        setQuery("");
        setMentionStartIndex(-1);
      }
    },
    []
  );

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    onChange(newVal);
    checkMentionTrigger(newVal, cursorPos);
  };

  const handleSelectUser = (user: TeamUserItem) => {
    if (mentionStartIndex === -1 || !textareaRef.current) return;

    const currentText = value;
    const cursorPos = textareaRef.current.selectionStart || currentText.length;
    const beforeMention = currentText.slice(0, mentionStartIndex);
    const afterMention = currentText.slice(cursorPos);

    const mentionBadgeText = `@${user.name} `;
    const newText = beforeMention + mentionBadgeText + afterMention;
    onChange(newText);

    setIsOpen(false);
    setQuery("");
    setMentionStartIndex(-1);

    // Reposition cursor right after the mention badge text
    const newCursorPos = beforeMention.length + mentionBadgeText.length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isOpen && filteredUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredUsers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selected = filteredUsers[selectedIndex];
        if (selected) {
          handleSelectUser(selected);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
    }

    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isOpen) {
        onSubmit();
      }
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const isDark = theme === "dark";

  return (
    <div className="relative w-full flex-1 min-w-0">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={
          className ||
          (isDark
            ? "w-full bg-white/10 text-white text-xs px-2.5 py-1.5 rounded-xl border border-white/20 focus:outline-hidden focus:border-[#007aff] resize-none placeholder:text-white/40"
            : "w-full bg-white text-xs px-2.5 py-1.5 rounded-xl border border-[#d1d1d6] focus:outline-hidden focus:ring-2 focus:ring-[#007aff] resize-none text-[#111] placeholder:text-[#8e8e93]")
        }
      />

      {/* Mention Autocomplete Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={`absolute left-0 bottom-full mb-1.5 w-64 max-h-52 overflow-y-auto rounded-2xl shadow-2xl border p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 ${
            isDark
              ? "bg-[#1c1c1e] border-white/15 text-white"
              : "bg-white border-[#ececf0] text-[#111]"
          }`}
        >
          <div
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 flex items-center gap-1 ${
              isDark ? "text-white/50" : "text-[#8e8e93]"
            }`}
          >
            <AtSign className="w-3 h-3 text-[#007aff]" />
            <span>Mencionar equipa ({filteredUsers.length})</span>
          </div>

          {filteredUsers.length === 0 ? (
            <div
              className={`p-2.5 text-center text-xs ${
                isDark ? "text-white/40" : "text-[#8e8e93]"
              }`}
            >
              Nenhum membro encontrado com &quot;{query}&quot;
            </div>
          ) : (
            filteredUsers.map((user, idx) => {
              const isSelected = idx === selectedIndex;
              const initials = user.name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0])
                .join("")
                .toUpperCase() || "CFM";

              return (
                <button
                  key={user.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectUser(user);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition cursor-pointer ${
                    isSelected
                      ? isDark
                        ? "bg-[#007aff] text-white"
                        : "bg-[#007aff]/10 text-[#007aff] font-semibold"
                      : isDark
                      ? "hover:bg-white/10 text-white"
                      : "hover:bg-[#f2f2f5] text-[#111]"
                  }`}
                >
                  {/* User Avatar */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isSelected && isDark
                        ? "bg-white text-[#007aff]"
                        : "bg-gradient-to-tr from-[#007aff] to-[#5856d6] text-white"
                    }`}
                  >
                    {user.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={user.avatarUrl}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate">{user.name}</div>
                    {user.role && (
                      <div
                        className={`text-[10px] truncate ${
                          isSelected && isDark
                            ? "text-white/80"
                            : isDark
                            ? "text-white/50"
                            : "text-[#8e8e93]"
                        }`}
                      >
                        {user.role === "owner"
                          ? "Proprietário"
                          : user.role === "admin"
                          ? "Administrador"
                          : user.role === "producer"
                          ? "Produtor"
                          : "Equipa"}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
