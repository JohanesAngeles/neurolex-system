import React, { useState } from 'react';
import '../../styles/others/ProfilePicture.css';

const ProfilePicture = ({ userData }) => {
  const [imageError, setImageError] = useState(false);
  
  // Function to generate initials from first and last name
  const getInitials = () => {
    if (!userData) return '';
    
    const firstName = userData.firstName || '';
    const lastName = userData.lastName || '';
    
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };
  
  // Using the specified fixed color for the avatar background
  const getAvatarColor = () => {
    return '#548170'; // Fixed teal/green color as requested
  };
  
  // Determine the image source
  const getImageSource = () => {
    if (!userData || !userData.profilePicture) return null;
    
    // If the profile picture is the default, return null
    if (userData.profilePicture === 'default-profile.png') return null;
    
    // Otherwise return the profile picture path
    // You might need to adjust this based on how your images are stored/served
    return `/images/${userData.profilePicture}`;
  };
  
  const imageSource = getImageSource();
  
  return (
    <div className="profile-picture-container">
      {imageSource && !imageError ? (
        <img 
          src={imageSource} 
          alt={`${userData.firstName} ${userData.lastName}`} 
          className="profile-image"
          onError={() => setImageError(true)}
        />
      ) : (
        <div 
          className="avatar-circle" 
          style={{ 
            backgroundColor: getAvatarColor(),
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.4rem',
            fontFamily: 'IBM Plex Mono',
          }}
        >
          {getInitials()}
        </div>
      )}
    </div>
  );
};

export default ProfilePicture;