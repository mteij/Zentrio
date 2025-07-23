import { h } from "preact";
import { profileStyles } from "../constants/styles.ts";
import { handleProfileClick } from "../utils/profileUtils.ts";

interface Profile {
  _id: string;
  name: string;
  profilePictureUrl: string;
}

interface ProfileCardProps {
  profile: Profile;
  isEditMode?: boolean;
  isMobile?: boolean;
  onEditClick?: (profile: Profile) => void;
  cardWidth?: string;
  avatarSize?: string;
}

export function ProfileCard({ 
  profile, 
  isEditMode = false, 
  isMobile = false,
  onEditClick,
  cardWidth = isMobile ? "120px" : "220px",
  avatarSize = isMobile ? "100px" : "120px"
}: ProfileCardProps) {
  const handleClick = () => {
    if (isEditMode && onEditClick) {
      onEditClick(profile);
    } else {
      handleProfileClick(profile._id);
    }
  };

  return (
    <div
      key={profile._id}
      class={profileStyles.card}
      style={{ width: cardWidth, cursor: isEditMode ? "default" : "pointer" }}
      onClick={!isEditMode ? handleClick : undefined}
    >
      <div
        class={profileStyles.avatar}
        style={{
          backgroundImage: `url(${profile.profilePictureUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          width: avatarSize,
          height: avatarSize,
        }}
      >
      </div>
      <span class={profileStyles.name} style={{ fontSize: isMobile ? "14px" : "18px" }}>
        {profile.name}
      </span>
      {!isMobile && !isEditMode && onEditClick && (
        <button
          class={profileStyles.editButton}
          onClick={(e) => {
            e.stopPropagation();
            onEditClick(profile);
          }}
        >
          ✏️
        </button>
      )}
      {isMobile && isEditMode && onEditClick && (
        <button
          class="mt-2 bg-blue-600 text-white px-3 py-1 rounded text-sm"
          onClick={() => onEditClick(profile)}
        >
          Edit
        </button>
      )}
    </div>
  );
}