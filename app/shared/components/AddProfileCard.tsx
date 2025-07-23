import { h } from "preact";
import { profileStyles } from "../constants/styles.ts";

interface AddProfileCardProps {
  onAddClick: () => void;
  isMobile?: boolean;
  disabled?: boolean;
  cardWidth?: string;
  avatarSize?: string;
}

export function AddProfileCard({ 
  onAddClick, 
  isMobile = false, 
  disabled = false,
  cardWidth = isMobile ? "120px" : "220px",
  avatarSize = isMobile ? "100px" : "120px"
}: AddProfileCardProps) {
  return (
    <div
      class={`${profileStyles.addButton} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={{ width: cardWidth, height: `calc(${avatarSize} + 60px)` }}
      onClick={disabled ? undefined : onAddClick}
    >
      <div
        class="rounded-full bg-gray-600 flex items-center justify-center text-gray-300 text-4xl mb-2"
        style={{ width: avatarSize, height: avatarSize }}
      >
        +
      </div>
      <span class="text-sm text-gray-400">Add Profile</span>
    </div>
  );
}