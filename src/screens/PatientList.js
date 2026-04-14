import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Card, Searchbar, Chip, Avatar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

const PatientList = () => {
  const navigation = useNavigation();
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    // Mock patient data for MVP
    const mockPatients = [
      {
        id: 1,
        name: 'John Doe',
        age: 67,
        initials: 'JD',
        color: '#1976D2',
        lastSession: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        status: 'active',
        totalSessions: 24,
        avgSeverity: 2.3,
        recentEpisodes: 5,
      },
      {
        id: 2,
        name: 'Mary Smith',
        age: 72,
        initials: 'MS',
        color: '#4CAF50',
        lastSession: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
        status: 'active',
        totalSessions: 31,
        avgSeverity: 1.8,
        recentEpisodes: 3,
      },
      {
        id: 3,
        name: 'Robert Kim',
        age: 64,
        initials: 'RK',
        color: '#F44336',
        lastSession: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        status: 'inactive',
        totalSessions: 18,
        avgSeverity: 3.1,
        recentEpisodes: 8,
      },
      {
        id: 4,
        name: 'Lisa Martinez',
        age: 59,
        initials: 'LM',
        color: '#FF9800',
        lastSession: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
        status: 'active',
        totalSessions: 42,
        avgSeverity: 2.7,
        recentEpisodes: 6,
      },
      {
        id: 5,
        name: 'James Taylor',
        age: 70,
        initials: 'JT',
        color: '#9C27B0',
        lastSession: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        status: 'inactive',
        totalSessions: 15,
        avgSeverity: 1.5,
        recentEpisodes: 2,
      },
    ];

    setPatients(mockPatients);
    setFilteredPatients(mockPatients);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPatients();
    setRefreshing(false);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    
    if (query.trim() === '') {
      setFilteredPatients(patients);
    } else {
      const filtered = patients.filter(patient =>
        patient.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredPatients(filtered);
    }
  };

  const getSeverityColor = (severity) => {
    if (severity < 1.0) return '#4CAF50';
    if (severity < 2.0) return '#8BC34A';
    if (severity < 3.0) return '#FFC107';
    if (severity < 4.0) return '#FF9800';
    return '#F44336';
  };

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const renderPatient = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => navigation.navigate('PatientDetail', { patientId: item.id, patientName: item.name })}
    >
      <Card style={styles.patientCard}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.patientHeader}>
            <Avatar.Text
              size={56}
              label={item.initials}
              style={{ backgroundColor: item.color }}
            />
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>{item.name}</Text>
              <Text style={styles.patientAge}>Age {item.age}</Text>
              <Text style={styles.lastSession}>
                Last session: {getTimeAgo(item.lastSession)}
              </Text>
            </View>
            <Chip
              style={[
                styles.statusChip,
                { backgroundColor: item.status === 'active' ? '#E8F5E9' : '#EEEEEE' }
              ]}
              textStyle={{
                color: item.status === 'active' ? '#4CAF50' : '#999',
                fontSize: 12,
              }}
            >
              {item.status}
            </Chip>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.totalSessions}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: getSeverityColor(item.avgSeverity) }]}>
                {item.avgSeverity.toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>Avg Severity</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.recentEpisodes}</Text>
              <Text style={styles.statLabel}>Recent Episodes</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search patients..."
        onChangeText={handleSearch}
        value={searchQuery}
        style={styles.searchBar}
      />

      {filteredPatients.length > 0 && (
        <Text style={styles.count}>
          {filteredPatients.length} {filteredPatients.length === 1 ? 'patient' : 'patients'}
        </Text>
      )}

      <FlatList
        data={filteredPatients}
        renderItem={renderPatient}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976D2']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No patients found</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchBar: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  count: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 14,
    color: '#666',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  patientCard: {
    marginBottom: 12,
    elevation: 2,
  },
  cardContent: {
    padding: 16,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  patientInfo: {
    flex: 1,
    marginLeft: 16,
  },
  patientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  patientAge: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  lastSession: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusChip: {
    height: 28,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default PatientList;