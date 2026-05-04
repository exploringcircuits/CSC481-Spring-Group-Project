import React from "react";
import "../../styles/shared/Tabs.css";

export interface Tab {
    id: string;
    label: string;
    disabled?: boolean;
}

export interface TabsProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange }) => {
    return (
        <div className="tabs-container">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
                    onClick={() => !tab.disabled && onTabChange(tab.id)}
                    disabled={tab.disabled}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
};

export default Tabs;
