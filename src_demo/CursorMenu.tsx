import React, { useEffect, useRef, useState } from 'react';

const CursorMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCursor, setSelectedCursor] = useState('cross');
  const [tooltipToggle, setTooltipToggle] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Cursor tools
  const cursorTools = [
    { id: 'cross', label: 'Cross' },
    { id: 'dot', label: 'Dot' },
    { id: 'arrow', label: 'Arrow' },
    { id: 'demo', label: 'Demonstration' },
    { id: 'eraser', label: 'Eraser' },
  ];

  const handleCursorSelect = (toolId, toolLabel) => {
    setSelectedCursor(toolId);
    console.log(`Tool selected: ${toolLabel}`);
    setIsOpen(false);
  };

  const handleToggleChange = () => {
    const newState = !tooltipToggle;
    setTooltipToggle(newState);
    console.log(`Values tooltip on long press: ${newState}`);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center justify-center w-9 h-9 rounded transition-all duration-200 ${
          isOpen
            ? 'bg-blue-500 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
        }`}
        title="Cursor Tools"
      >
        {/* Crosshair Icon */}
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute left-full ml-2 top-0 w-56 bg-white rounded-lg shadow-2xl overflow-hidden z-50 border border-gray-200"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Cursors
            </p>
          </div>

          {/* Tools List */}
          <div className="py-2">
            {cursorTools.map((tool) => {
              const isActive = selectedCursor === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => handleCursorSelect(tool.id, tool.label)}
                  className={`w-full px-4 py-2 text-left flex items-center justify-between transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm">{tool.label}</span>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Toggle Section */}
          <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700 max-w-[70%]">
              Values tooltip on long press
            </label>

            {/* Toggle Switch */}
            <button
              onClick={handleToggleChange}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                tooltipToggle ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  tooltipToggle ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CursorMenu;
