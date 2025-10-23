import React from 'react';
import TripsTab from '../TripsTab';
import TripsListPage from './TripsListPage';
import PendingTripsPage from './PendingTripsPage';

const TripsPage = ({ 
  activeSubTab, 
  setActiveSubTab, 
  vehicles, 
  fetchVehicles 
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Trips</h2>
      </div>

      {/* Trips Sub Navigation */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveSubTab(prev => ({ ...prev, trips: 'add' }))}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeSubTab.trips === 'add'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Add Trip
            </button>
            <button
              onClick={() => setActiveSubTab(prev => ({ ...prev, trips: 'pending' }))}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeSubTab.trips === 'pending'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Trips
            </button>
            <button
              onClick={() => setActiveSubTab(prev => ({ ...prev, trips: 'view' }))}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeSubTab.trips === 'view'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Confirmed Trips
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeSubTab.trips === 'add' && (
            <TripsTab vehicles={vehicles} onRefreshVehicles={fetchVehicles} />
          )}

          {activeSubTab.trips === 'pending' && (
            <PendingTripsPage />
          )}

          {activeSubTab.trips === 'view' && (
            <TripsListPage />
          )}
        </div>
      </div>
    </div>
  );
};

export default TripsPage;



