'use client'; 

import React from 'react';
import { NeynarProfileCard } from '@neynar/react';

export { NeynarProfileCard };

// You might be exporting Neynar components here for easy access, e.g.:
// import { NeynarAuthButton, NeynarFeedList } from '@neynar/react';

const NeynarComponent: React.FC = () => {
    // This component can be used to wrap logic or render specific Neynar UI
    return (
        <div className="neynar-component-wrapper">
            {/* For example: <NeynarAuthButton /> */}
            <p>Neynar Component Placeholder</p>
        </div>
    );
};

export default NeynarComponent;